/**
 * Shared auth-core tests: password hashing, sessions, configuration
 * evaluation, rate limiting, and the shared /api/auth/* service used by
 * BOTH deployment adapters (Cloudflare worker + Node server).
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  AuthService,
  constantTimeEqual,
  deriveKey,
  evaluateAuthConfig,
  formatHash,
  generateSalt,
  isAuthEnabled,
  parseHash,
  verifyPassword,
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  readSessionCookie,
  verifySessionToken,
  RateLimiter,
} from "../shared/auth-core/index";
import { hashPassword, DEFAULT_ITERATIONS } from "../scripts/lib/password-hash.mjs";

const STRONG_SECRET = "unit-test-session-secret-0123456789abcdef";

async function makeHash(password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  return hashPassword(password, iterations);
}

/* ------------------------------ Configuration ----------------------------- */

describe("auth configuration", () => {
  it("defaults AUTH_ENABLED to enabled (fail closed)", () => {
    expect(isAuthEnabled(undefined)).toBe(true);
    expect(isAuthEnabled("")).toBe(true);
    expect(isAuthEnabled("not-a-bool")).toBe(true);
    expect(isAuthEnabled("false")).toBe(false);
    expect(isAuthEnabled("False")).toBe(false);
    expect(isAuthEnabled(" true ")).toBe(true);
  });

  it("evaluates the unconfigured state", () => {
    const result = evaluateAuthConfig({});
    expect(result.enabled).toBe(true);
    expect(result.state).toBe("unconfigured");
  });

  it("evaluates the malformed state without throwing on garbage", () => {
    const result = evaluateAuthConfig({
      PASSWORD_HASH: "garbage$$not-a-hash",
      SESSION_SECRET: STRONG_SECRET,
    });
    expect(result.state).toBe("malformed");
  });

  it("evaluates missing SESSION_SECRET", () => {
    const hash = formatHash({
      iterations: 10,
      salt: generateSalt(),
      derivedKey: new Uint8Array(32),
    });
    const result = evaluateAuthConfig({ PASSWORD_HASH: hash });
    expect(result.state).toBe("missing-session-secret");
  });

  it("rejects a short SESSION_SECRET", () => {
    const hash = formatHash({
      iterations: 10,
      salt: generateSalt(),
      derivedKey: new Uint8Array(32),
    });
    const result = evaluateAuthConfig({ PASSWORD_HASH: hash, SESSION_SECRET: "short" });
    expect(result.state).toBe("missing-session-secret");
  });

  it("returns disabled when auth is off (secrets not required)", () => {
    const result = evaluateAuthConfig({ AUTH_ENABLED: "false" });
    expect(result.state).toBe("disabled");
    expect(result.enabled).toBe(false);
  });

  it("never leaks secret values in messages", () => {
    const secret = "super-secret-value-abc";
    const result = evaluateAuthConfig({ PASSWORD_HASH: "bad", SESSION_SECRET: secret });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

/* -------------------------------- Password -------------------------------- */

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await makeHash("correct horse battery staple");
    const result = await verifyPassword("correct horse battery staple", hash);
    expect(result.ok).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await makeHash("correct horse battery staple");
    const result = await verifyPassword("wrong password", hash);
    expect(result.ok).toBe(false);
  });

  it("fails closed on missing and malformed hashes", async () => {
    expect((await verifyPassword("x", undefined)).ok).toBe(false);
    expect((await verifyPassword("x", null)).ok).toBe(false);
    expect((await verifyPassword("x", "")).ok).toBe(false);
    expect((await verifyPassword("x", "bcrypt$2a$10$whatever")).ok).toBe(false);
    expect((await verifyPassword("x", "pbkdf2-sha256$notanumber$salt$key")).ok).toBe(false);
    expect((await verifyPassword("x", "pbkdf2-sha256$100000$!!!$!!!")).ok).toBe(false);
  });

  it("rejects iterations outside the sane range", () => {
    expect(parseHash("pbkdf2-sha256$0$salt$key")).toBeNull();
    expect(parseHash("pbkdf2-sha256$99999999$salt$key")).toBeNull();
  });

  it("produces a unique salt per hash", async () => {
    const a = await makeHash("same-password");
    const b = await makeHash("same-password");
    expect(a).not.toBe(b);
    const parsedA = parseHash(a)!;
    const parsedB = parseHash(b)!;
    expect(constantTimeEqual(parsedA.salt, parsedB.salt)).toBe(false);
  });

  it("uses the same format in the CLI generator and the runtime verifier", async () => {
    // scripts/lib/password-hash.mjs generated this hash; auth-core verifies it.
    const generated = await makeHash("cross-check");
    const result = await verifyPassword("cross-check", generated);
    expect(result.ok).toBe(true);
    // And the reverse direction: auth-core format → script-verified parsing.
    const salt = generateSalt();
    const key = await deriveKey("reverse-check", salt, DEFAULT_ITERATIONS);
    const hash = formatHash({ iterations: DEFAULT_ITERATIONS, salt, derivedKey: key });
    expect(hash.startsWith("pbkdf2-sha256$")).toBe(true);
    expect(parseHash(hash)).not.toBeNull();
  });

  it("supports configurable work factors embedded in the hash", async () => {
    const hash = await makeHash("low-iterations", 1000);
    expect(hash.startsWith("pbkdf2-sha256$1000$")).toBe(true);
    expect((await verifyPassword("low-iterations", hash)).ok).toBe(true);
  });
});

/* --------------------------------- Sessions -------------------------------- */

describe("sessions", () => {
  it("creates and verifies a session token", async () => {
    const { token, payload } = await createSessionToken(STRONG_SECRET);
    const verified = await verifySessionToken(token, STRONG_SECRET);
    expect(verified).not.toBeNull();
    expect(verified!.payload.sid).toBe(payload.sid);
    expect(verified!.payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects tampered tokens", async () => {
    const { token } = await createSessionToken(STRONG_SECRET);
    const [body] = token.split(".");
    const forgedBody = btoa(JSON.stringify({ v: 1, iat: 0, exp: 9999999999, sid: "evil" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = token.replace(body!, forgedBody);
    expect(await verifySessionToken(tampered, STRONG_SECRET)).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    const { token } = await createSessionToken(STRONG_SECRET);
    expect(await verifySessionToken(token, "another-secret-value-0123456789abcdef")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const { token } = await createSessionToken(STRONG_SECRET, { ttlSeconds: -10 });
    expect(await verifySessionToken(token, STRONG_SECRET)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifySessionToken("garbage", STRONG_SECRET)).toBeNull();
    expect(await verifySessionToken("a.b.c", STRONG_SECRET)).toBeNull();
    expect(await verifySessionToken(null, STRONG_SECRET)).toBeNull();
    expect(await verifySessionToken(undefined, STRONG_SECRET)).toBeNull();
  });

  it("rotation of SESSION_SECRET invalidates prior sessions", async () => {
    const { token } = await createSessionToken("old-secret-0123456789abcdefghij");
    expect(await verifySessionToken(token, "new-secret-0123456789abcdefghij")).toBeNull();
  });

  it("issues independent sessions per browser (concurrent users)", async () => {
    const first = await createSessionToken(STRONG_SECRET);
    const second = await createSessionToken(STRONG_SECRET);
    expect(first.payload.sid).not.toBe(second.payload.sid);
    expect(await verifySessionToken(second.token, STRONG_SECRET)).not.toBeNull();
  });

  it("builds cookies with the required security attributes", async () => {
    const { token } = await createSessionToken(STRONG_SECRET, { ttlSeconds: 3600 });
    const cookie = buildSessionCookie(token, { ttlSeconds: 3600, secureCookie: true });
    expect(cookie).toContain("rymark_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=3600");
    // Token value never contains the raw secret.
    expect(cookie).not.toContain(STRONG_SECRET);
  });

  it("clears cookies with Max-Age=0", () => {
    const cookie = buildClearSessionCookie({ secureCookie: true });
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
  });

  it("reads the session cookie from a Cookie header", async () => {
    const { token } = await createSessionToken(STRONG_SECRET);
    const cookie = buildSessionCookie(token, { secureCookie: false });
    expect(readSessionCookie(`other=1; ${cookie}; more=2`)).toBe(token);
    expect(readSessionCookie("other=1")).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
  });
});

/* ------------------------------- Rate limiting ----------------------------- */

describe("rate limiting", () => {
  it("allows up to the limit then blocks with retryAfter", () => {
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    const blocked = limiter.check("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("keys buckets per client", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("successful logins reset the bucket", () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("a");
    limiter.reset("a");
    expect(limiter.check("a").allowed).toBe(true);
  });
});

/* ----------------------------- Shared auth service ------------------------- */

function loginRequest(password: string, headers: Record<string, string> = {}): Request {
  return new Request("https://docs.example.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ password }),
  });
}

describe("AuthService (shared by Cloudflare and Node adapters)", () => {
  const configuredEnv = {
    AUTH_ENABLED: "true",
    // "password123" hashed with 1000 iterations for fast tests.
    PASSWORD_HASH: "",
    SESSION_SECRET: STRONG_SECRET,
  };
  let env: typeof configuredEnv;
  beforeAll(async () => {
    const hash = await makeHash("password123", 1000);
    env = { ...configuredEnv, PASSWORD_HASH: hash };
  });

  it("handles the full login → session → logout flow", async () => {
    const service = new AuthService(env);
    const status = await service.handleAuthApi(
      new Request("https://x.test/api/auth/status", { headers: { accept: "application/json" } }),
    );
    expect(status?.status).toBe(200);
    const body = (await status!.json()) as { authenticated: boolean; state: string };
    expect(body.authenticated).toBe(false);
    expect(body.state).toBe("ok");

    const failed = await service.handleAuthApi(loginRequest("wrong"));
    expect(failed!.status).toBe(401);

    const success = await service.handleAuthApi(loginRequest("password123"));
    expect(success!.status).toBe(200);
    const setCookie = success!.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");

    const token = readSessionCookie(setCookie)!;
    const sessionRequest = new Request("https://x.test/api/auth/session", {
      headers: { cookie: `rymark_session=${token}` },
    });
    const session = await service.handleAuthApi(sessionRequest);
    const sessionBody = (await session!.json()) as { authenticated: boolean };
    expect(sessionBody.authenticated).toBe(true);

    const logout = await service.handleAuthApi(
      new Request("https://x.test/api/auth/logout", { method: "POST" }),
    );
    expect(logout!.headers.getSetCookie()[0]).toContain("Max-Age=0");
  });

  it("rate limits repeated failed logins", async () => {
    const service = new AuthService(env);
    for (let i = 0; i < 5; i++) {
      const response = await service.handleAuthApi(loginRequest("wrong", { "x-real-ip": "9.9.9.9" }));
      expect(response!.status).toBe(401);
    }
    const blocked = await service.handleAuthApi(loginRequest("password123", { "x-real-ip": "9.9.9.9" }));
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("retry-after")).not.toBeNull();
  });

  it("returns 503 and never the login form data when unconfigured", async () => {
    const service = new AuthService({});
    const response = await service.handleAuthApi(loginRequest("anything"));
    expect(response!.status).toBe(503);
    const body = (await response!.json()) as { state: string };
    expect(body.state).toBe("unconfigured");
  });

  it("guards content requests: 401 for API-like, 302 for browser navigation", async () => {
    const service = new AuthService(env);

    const deniedJson = await service.guardContentRequest(
      new Request("https://x.test/content/manifest.json", { headers: { accept: "application/json" } }),
    );
    expect(deniedJson!.status).toBe(401);

    const deniedHtml = await service.guardContentRequest(
      new Request("https://x.test/content/Guide.md", { headers: { accept: "text/html" } }),
    );
    expect(deniedHtml!.status).toBe(302);
    expect(deniedHtml!.headers.get("location")).toContain("/");

    // Non-content paths are not guarded.
    expect(
      await service.guardContentRequest(new Request("https://x.test/assets/index.js")),
    ).toBeNull();

    // With a valid session, content is allowed.
    const success = await service.handleAuthApi(loginRequest("password123"));
    const token = readSessionCookie(success!.headers.get("set-cookie")!)!;
    const allowed = await service.guardContentRequest(
      new Request("https://x.test/content/Guide.md", {
        headers: { cookie: `rymark_session=${token}` },
      }),
    );
    expect(allowed).toBeNull();
  });

  it("serves public content when auth is disabled", async () => {
    const service = new AuthService({ AUTH_ENABLED: "false" });
    expect(
      await service.guardContentRequest(new Request("https://x.test/content/anything.md")),
    ).toBeNull();
    const status = await service.handleAuthApi(new Request("https://x.test/api/auth/status"));
    const body = (await status!.json()) as { enabled: boolean; authenticated: boolean };
    expect(body.enabled).toBe(false);
    expect(body.authenticated).toBe(true);
  });

  it("rejects invalid login payloads", async () => {
    const service = new AuthService(env);
    const badJson = new Request("https://x.test/api/auth/login", {
      method: "POST",
      body: "not json",
    });
    expect((await service.handleAuthApi(badJson))!.status).toBe(400);
    const tooLong = new Request("https://x.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "x".repeat(2000) }),
    });
    expect((await service.handleAuthApi(tooLong))!.status).toBe(400);
    const missing = new Request("https://x.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect((await service.handleAuthApi(missing))!.status).toBe(400);
  });

  it("returns 404 for unknown auth routes", async () => {
    const service = new AuthService(env);
    const response = await service.handleAuthApi(
      new Request("https://x.test/api/auth/unknown"),
    );
    expect(response!.status).toBe(404);
  });

  it("returns null for non-auth routes so adapters continue routing", async () => {
    const service = new AuthService(env);
    expect(await service.handleAuthApi(new Request("https://x.test/doc/README.md"))).toBeNull();
  });
});

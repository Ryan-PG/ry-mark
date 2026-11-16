/**
 * Auth-core service: the single implementation of the /api/auth/* endpoints
 * and of the content auth gate, shared by every deployment adapter.
 *
 * Adapters (Cloudflare _worker.js, self-hosted Node server, local dev
 * middleware) only provide the environment and hand over standard
 * Request/Response objects — everything security-related lives here so the
 * two deployment targets are guaranteed to behave identically.
 */
import { evaluateAuthConfig } from "./config.js";
import { verifyPassword } from "./password.js";
import {
  DEFAULT_COOKIE_NAME,
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  readSessionCookie,
  verifySessionToken,
} from "./session.js";
import { createLoginRateLimiter } from "./ratelimit.js";
import type { AuthStatusResponse, SecretEnv, SessionOptions } from "./types.js";

/** Content routes that always require a valid session when auth is enabled. */
export const PROTECTED_PREFIXES = ["/content/"];

/** Options an adapter passes to the service. */
export interface AuthServiceOptions {
  /** Session cookie flags; defaults are documented in docs/AUTHENTICATION.md. */
  readonly session?: Partial<SessionOptions>;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;
/** Maximum accepted login request body size. */
const MAX_LOGIN_BODY_BYTES = 4096;

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { ...init, headers: { ...JSON_HEADERS, ...init?.headers } });
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export class AuthService {
  readonly env: SecretEnv;
  private readonly sessionOptions: Partial<SessionOptions>;
  private readonly loginLimiter = createLoginRateLimiter();

  constructor(env: SecretEnv, options: AuthServiceOptions = {}) {
    this.env = env;
    this.sessionOptions = options.session ?? {};
  }

  /** Cookie flags, adapted to the request's transport security. */
  private cookieOptions(request: Request): Partial<SessionOptions> {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const urlProtocol = new URL(request.url).protocol.replace(":", "");
    const secure = urlProtocol === "https" || forwardedProto === "https";
    return { ...this.sessionOptions, secureCookie: this.sessionOptions.secureCookie ?? secure };
  }

  /** Best-effort client identification for rate limiting. */
  private clientKey(request: Request): string {
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    return "unknown";
  }

  private isHttps(request: Request): boolean {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const urlProtocol = new URL(request.url).protocol.replace(":", "");
    return urlProtocol === "https" || forwardedProto === "https";
  }

  /** Computes the current authentication configuration state. */
  evaluate(): ReturnType<typeof evaluateAuthConfig> {
    return evaluateAuthConfig(this.env);
  }

  /**
   * Handles any /api/auth/* request. Returns null when the path is not an
   * auth route so the adapter can fall through to its normal handling.
   */
  async handleAuthApi(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/auth/")) return null;

    const evaluation = this.evaluate();
    const route = url.pathname;

    if (route === "/api/auth/status" && request.method === "GET") {
      return json(await this.statusPayload(request));
    }

    if (route === "/api/auth/session" && request.method === "GET") {
      const session = await this.getVerifiedSession(request);
      if (!session) {
        return json({ authenticated: false }, { status: 401 });
      }
      return json({ authenticated: true, expiresAt: session.payload.exp * 1000 });
    }

    if (route === "/api/auth/login" && request.method === "POST") {
      return this.handleLogin(request, evaluation.state);
    }

    if (route === "/api/auth/logout" && request.method === "POST") {
      const response = json({ ok: true });
      response.headers.append(
        "set-cookie",
        buildClearSessionCookie({
          ...this.sessionOptions,
          cookieName: this.sessionOptions.cookieName ?? DEFAULT_COOKIE_NAME,
          secureCookie: this.cookieOptions(request).secureCookie,
        }),
      );
      return response;
    }

    return json({ error: "Not found." }, { status: 404 });
  }

  private async statusPayload(request: Request): Promise<AuthStatusResponse> {
    const evaluation = this.evaluate();
    if (!evaluation.enabled) {
      return { enabled: false, state: "disabled", authenticated: true };
    }
    const session = await this.getVerifiedSession(request);
    return {
      enabled: true,
      state: evaluation.state,
      authenticated: evaluation.state === "ok" && session !== null,
      message: evaluation.message,
    };
  }

  private async handleLogin(request: Request, state: string): Promise<Response> {
    if (state === "disabled") {
      return json({ error: "Authentication is disabled." }, { status: 400 });
    }
    if (state !== "ok") {
      // Fail closed with a distinct code the frontend maps to setup screens.
      return json({ error: "Authentication is not configured.", state }, { status: 503 });
    }

    // Rate limit BEFORE reading the body: cheap rejection of bursts.
    const clientKey = this.clientKey(request);
    const limit = this.loginLimiter.check(clientKey);
    if (!limit.allowed) {
      return json(
        { error: "Too many attempts. Try again later." },
        {
          status: 429,
          headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
        },
      );
    }

    let body: Record<string, unknown> | null = null;
    try {
      const raw = await request.text();
      if (raw.length > MAX_LOGIN_BODY_BYTES) {
        return json({ error: "Invalid request." }, { status: 400 });
      }
      body = safeJsonParse(raw);
    } catch {
      return json({ error: "Invalid request." }, { status: 400 });
    }

    const password = body?.password;
    if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
      return json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await verifyPassword(password, this.env.PASSWORD_HASH);
    if (!result.ok) {
      if (result.reason === "error") {
        // Internal failure: do not leak details, but do not count it as an
        // invalid password attempt either.
        return json({ error: "Authentication error." }, { status: 500 });
      }
      return json({ error: "Invalid password." }, { status: 401 });
    }

    // Success: clear the failure counter for this client.
    this.loginLimiter.reset(clientKey);

    const { token } = await createSessionToken(this.env.SESSION_SECRET!, {
      ...this.sessionOptions,
      secureCookie: this.cookieOptions(request).secureCookie,
    });
    const response = json({ ok: true });
    response.headers.append(
      "set-cookie",
      buildSessionCookie(token, {
        ...this.sessionOptions,
        cookieName: this.sessionOptions.cookieName ?? DEFAULT_COOKIE_NAME,
        secureCookie: this.cookieOptions(request).secureCookie,
      }),
    );
    return response;
  }

  /** Returns the verified session for a request, or null. */
  async getVerifiedSession(request: Request): Promise<import("./types.js").VerifiedSession | null> {
    const cookieName = this.sessionOptions.cookieName ?? DEFAULT_COOKIE_NAME;
    const token = readSessionCookie(request.headers.get("cookie"), cookieName);
    return verifySessionToken(token, this.env.SESSION_SECRET);
  }

  /**
   * Auth gate for protected content. Returns a Response to reject the request
   * (401 for APIs/assets, minimal HTML for direct document navigation), or
   * null when the request may proceed.
   */
  async guardContentRequest(request: Request): Promise<Response | null> {
    const evaluation = this.evaluate();
    if (!evaluation.enabled) return null; // auth disabled: public content

    const url = new URL(request.url);
    const isProtected = PROTECTED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    if (!isProtected) return null;

    const session = await this.getVerifiedSession(request);
    if (session) return null;

    const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");
    if (acceptsHtml) {
      // Direct document URL opened in a browser: redirect to the app shell,
      // which renders the login/setup screen.
      return new Response(null, {
        status: 302,
        headers: { location: "/?auth=required" },
      });
    }
    return json({ error: "Authentication required." }, { status: 401 });
  }
}

/**
 * Deployment adapter tests:
 * - Cloudflare advanced-mode worker routing (dist/_worker.js behavior)
 * - Self-hosted static path safety (server/static.ts)
 *
 * These verify that both adapters enforce identical access rules.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import worker from "../worker/entry";
import { resolveSafePath, contentTypeFor } from "../server/static";
import { isAuthEnabled } from "../shared/auth-core/index";
import type { RyMarkWorkerEnv } from "../worker/env";

const SESSION_SECRET = "adapter-test-secret-0123456789abcdef";

function makeEnv(overrides: Partial<RyMarkWorkerEnv> = {}): RyMarkWorkerEnv {
  return {
    ASSETS: {
      fetch: async (request: Request | string) => {
        // The worker may fetch by string (e.g. "/index.html").
        const url = new URL(typeof request === "string" ? `https://x.test${request}` : request.url);
        if (url.pathname === "/index.html") {
          return new Response("<html>shell</html>", { headers: { "content-type": "text/html" } });
        }
        if (url.pathname === "/content/Guide.md") {
          return new Response("# Guide", { headers: { "content-type": "text/markdown" } });
        }
        return new Response("not found", { status: 404 });
      },
    },
    PASSWORD_HASH: "",
    SESSION_SECRET,
    ...overrides,
  };
}

async function sessionCookieFor(env: RyMarkWorkerEnv, password: string): Promise<string> {
  const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
  const response = await workerDefault.fetch(
    new Request("https://x.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
    env,
    {},
  );
  const setCookie = response.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0]!;
}

const TEST_HASH =
  "pbkdf2-sha256$1000$fLFhKav8hpyXGZPbbDtwoA$tu4TLZIrUbXaWaaPEK51RwuoNlVAJ-JpOlJNh62uZ40"; // "password123" (1000 iters)

describe("Cloudflare worker adapter", () => {
  it("blocks protected content without a session (fail closed)", async () => {
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(
      new Request("https://x.test/content/Guide.md", { headers: { accept: "application/json" } }),
      makeEnv({ PASSWORD_HASH: TEST_HASH }),
      {},
    );
    expect(response.status).toBe(401);
  });

  it("redirects browser navigation to the shell", async () => {
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(
      new Request("https://x.test/content/Guide.md", { headers: { accept: "text/html" } }),
      makeEnv({ PASSWORD_HASH: TEST_HASH }),
      {},
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/?auth=required");
  });

  it("serves protected content with a valid session", async () => {
    const env = makeEnv({ PASSWORD_HASH: TEST_HASH });
    const cookie = await sessionCookieFor(env, "password123");
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(
      new Request("https://x.test/content/Guide.md", {
        headers: { accept: "text/markdown", cookie },
      }),
      env,
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Guide");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns 404 JSON for missing protected assets (no SPA leakage)", async () => {
    const env = makeEnv({ PASSWORD_HASH: TEST_HASH });
    const cookie = await sessionCookieFor(env, "password123");
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(
      new Request("https://x.test/content/does-not-exist.md", {
        headers: { accept: "application/json", cookie },
      }),
      env,
      {},
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Not found.");
  });

  it("fails closed when PASSWORD_HASH is missing", async () => {
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(
      new Request("https://x.test/content/Guide.md", { headers: { accept: "application/json" } }),
      makeEnv(), // no PASSWORD_HASH
      {},
    );
    expect(response.status).toBe(401);
  });

  it("serves the app shell for the root and unknown SPA routes", async () => {
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const root = await workerDefault.fetch(
      new Request("https://x.test/", { headers: { accept: "text/html" } }),
      makeEnv(),
      {},
    );
    expect(root.status).toBe(200);
    expect(await root.text()).toContain("shell");
    expect(root.headers.get("content-security-policy")).toContain("default-src 'self'");

    const deep = await workerDefault.fetch(
      new Request("https://x.test/doc/Engineering/API.md", { headers: { accept: "text/html" } }),
      makeEnv(),
      {},
    );
    expect(deep.status).toBe(200);
    expect(await deep.text()).toContain("shell");
  });

  it("serves public content when auth is disabled", async () => {
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(
      new Request("https://x.test/content/Guide.md", { headers: { accept: "application/json" } }),
      makeEnv({ AUTH_ENABLED: "false" }),
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Guide");
  });

  it("exposes /healthz without authentication", async () => {
    const workerDefault = worker as { fetch(request: Request, env: RyMarkWorkerEnv, ctx: unknown): Promise<Response> };
    const response = await workerDefault.fetch(new Request("https://x.test/healthz"), makeEnv(), {});
    expect(response.status).toBe(200);
  });
});

describe("self-hosted static path safety", () => {
  // Use a resolved root so expectations match path.resolve semantics on any OS.
  const root = path.resolve("/app/dist");

  it("resolves safe paths inside the root", () => {
    expect(resolveSafePath(root, "/assets/index.js")).toBe(
      path.resolve(root, "assets/index.js"),
    );
    expect(resolveSafePath(root, "/content/Engineering/API.md")).toBe(
      path.resolve(root, "content/Engineering/API.md"),
    );
  });

  it("rejects every traversal variant", () => {
    expect(resolveSafePath(root, "/../etc/passwd")).toBeNull();
    expect(resolveSafePath(root, "/content/../../../etc/passwd")).toBeNull();
    expect(resolveSafePath(root, "/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(resolveSafePath(root, "/content/%2e%2e/secret")).toBeNull();
    expect(resolveSafePath(root, "/..%2f..%2fetc%2fpasswd")).toBeNull();
    expect(resolveSafePath(root, "/content\0/x")).toBeNull();
  });

  it("maps extensions to content types", () => {
    expect(contentTypeFor("x.md")).toBe("text/markdown; charset=utf-8");
    expect(contentTypeFor("x.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("x.json")).toBe("application/json; charset=utf-8");
    expect(contentTypeFor("x.unknown")).toBe("application/octet-stream");
  });

  it("parses AUTH_ENABLED identically to the Cloudflare adapter", () => {
    expect(isAuthEnabled(undefined)).toBe(true);
    expect(isAuthEnabled("false")).toBe(false);
    expect(isAuthEnabled("true")).toBe(true);
  });
});

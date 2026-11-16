/**
 * Ry-Mark Cloudflare Pages adapter (advanced-mode worker, bundled to
 * dist/_worker.js by scripts/build-worker.mjs).
 *
 * WHY advanced mode: in standard Pages routing, static assets are served
 * BEFORE Functions are considered, so a functions/[[path]].ts catch-all can
 * never protect files that exist in the build output. dist/_worker.js
 * intercepts EVERY request, which lets us fail closed on all protected
 * content (markdown sources, HTML documents, images, the manifest and the
 * search index) while serving the public application shell through ASSETS.
 *
 * All authentication logic lives in shared/auth-core — this file is only
 * routing and header plumbing.
 */
import { AuthService } from "../shared/auth-core/index.js";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-opener-policy": "same-origin",
  // App shell CSP: self-hosted assets only, inline styles (React style props),
  // https images for documentation, and self-frames for HTML documents.
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

/** Security headers applied to protected content responses. */
const CONTENT_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function parseSessionTtlSeconds(env: RyMarkWorkerEnv): number | undefined {
  const hours = Number.parseFloat(env.SESSION_TTL_HOURS ?? "");
  if (!Number.isFinite(hours) || hours <= 0) return undefined;
  return Math.floor(hours * 3600);
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    result.headers.set(name, value);
  }
  return result;
}

export default {
  async fetch(request: Request, env: RyMarkWorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Explicit SecretEnv projection: only auth-relevant variables are passed,
    // satisfying the shared core's index-signature contract.
    const authService = new AuthService(
      {
        AUTH_ENABLED: env.AUTH_ENABLED,
        PASSWORD_HASH: env.PASSWORD_HASH,
        SESSION_SECRET: env.SESSION_SECRET,
      },
      { session: { ttlSeconds: parseSessionTtlSeconds(env) } },
    );

    // 1. Infrastructure auth endpoints (public; they enforce their own rate
    //    limiting and fail-closed configuration rules).
    const authResponse = await authService.handleAuthApi(request);
    if (authResponse) return withHeaders(authResponse, { "x-content-type-options": "nosniff" });

    // 2. Health check (public, no secrets revealed).
    if (url.pathname === "/healthz") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }

    // 3. Protected content: markdown sources, HTML documents, images, the
    //    manifest and the search index. Fails closed without a session.
    if (url.pathname.startsWith("/content/") || url.pathname === "/content") {
      const denial = await authService.guardContentRequest(request);
      if (denial) return withHeaders(denial, { "x-content-type-options": "nosniff" });

      const asset = await env.ASSETS.fetch(request);
      if (asset.status === 404) {
        // Do not leak directory existence or fall through to the SPA shell.
        return new Response(JSON.stringify({ error: "Not found." }), {
          status: 404,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return withHeaders(asset, CONTENT_HEADERS);
    }

    // 4. Public application shell and its bundles. Unknown SPA routes fall
    //    back to index.html so client-side routing works on deep links.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 404 && (request.headers.get("accept") ?? "").includes("text/html")) {
      const shell = await env.ASSETS.fetch("/index.html");
      return withHeaders(shell, SECURITY_HEADERS);
    }
    return withHeaders(asset, SECURITY_HEADERS);
  },
};

/**
 * Ry-Mark self-hosted adapter: a dependency-free Node.js HTTP server.
 *
 * It enforces EXACTLY the same authentication and content-access rules as the
 * Cloudflare Pages adapter, because both delegate to shared/auth-core:
 *
 *   /healthz      — public health check (self-hosted deployments)
 *   /api/auth/*   — auth endpoints (public; rate limited internally)
 *   /content/*    — auth-gated content (markdown, HTML, assets, manifest,
 *                   search index). Fails closed when auth is enabled.
 *   everything else — static frontend from dist/ with SPA fallback.
 *
 * Production startup: npm run start (builds the server, then runs it).
 * See docs/SELF-HOSTING.md for Docker, reverse proxy and HTTPS guidance.
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { AuthService } from "../shared/auth-core/index.js";
import { createServerConfig } from "./config.js";
import { toFetchRequest, writeFetchResponse } from "./http.js";
import { resolveSafePath, serveFile } from "./static.js";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-opener-policy": "same-origin",
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

const CONTENT_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function main(): Promise<void> {
  const config = createServerConfig();
  const authService = new AuthService(config.env, { session: config.sessionOptions });

  if (!fs.existsSync(path.join(config.distDir, "index.html"))) {
    console.error(
      `[ry-mark] No built frontend found at ${config.distDir}. ` +
        "Run `npm run build` first (the Docker image does this automatically).",
    );
    process.exit(1);
  }

  // Startup configuration report (facts only, never secret values).
  const evaluation = authService.evaluate();
  console.log(`[ry-mark] Auth enabled: ${evaluation.enabled}, state: ${evaluation.state}`);
  if (evaluation.state !== "ok" && evaluation.state !== "disabled" && evaluation.message) {
    console.warn(`[ry-mark] ${evaluation.message}`);
  }
  console.log(`[ry-mark] Serving frontend from ${config.distDir}`);

  const server = http.createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      const rawUrl = request.url ?? "/";
      const pathname = rawUrl.split("?")[0]!;
      const bodyAllowed = method === "POST" || method === "PUT" || method === "PATCH";

      const fetchRequest = await toFetchRequest(request, response, bodyAllowed);

      // 1. Auth endpoints (shared with the Cloudflare adapter).
      const authResponse = await authService.handleAuthApi(fetchRequest);
      if (authResponse) {
        await writeFetchResponse(authResponse, response);
        return;
      }

      // 2. Health check.
      if (pathname === "/healthz") {
        await writeFetchResponse(
          new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
          response,
        );
        return;
      }

      // 3. Protected content. Fails closed: the guard returns a denial
      //    response unless auth is disabled or the session is valid.
      if (pathname.startsWith("/content/") || pathname === "/content") {
        const denial = await authService.guardContentRequest(fetchRequest);
        if (denial) {
          await writeFetchResponse(denial, response);
          return;
        }
        // Map /content/<relative> into the content root.
        const relativeInContent = pathname.slice("/content".length);
        const contentPath =
          relativeInContent === "" || relativeInContent === "/"
            ? null
            : resolveSafePath(config.contentDir, relativeInContent);
        if (contentPath === null) {
          await writeFetchResponse(json({ error: "Not found." }, 404), response);
          return;
        }
        const file = serveFile(contentPath, "no-cache");
        if (!file) {
          await writeFetchResponse(json({ error: "Not found." }, 404), response);
          return;
        }
        response.writeHead(file.status, {
          "content-type": file.contentType,
          "cache-control": file.cacheControl,
          ...CONTENT_HEADERS,
        });
        response.end(file.body);
        return;
      }

      // 4. Static frontend with SPA fallback.
      const assetPath = resolveSafePath(config.distDir, pathname);
      const candidate =
        assetPath !== null ? serveFile(assetPath, "public, max-age=31536000, immutable") : null;

      if (candidate && path.basename(assetPath!) !== "_worker.js") {
        // Hashed asset bundles may be cached forever; index.html must not be.
        const cacheControl = pathname === "/" || pathname.endsWith(".html") ? "no-cache" : candidate.cacheControl;
        response.writeHead(candidate.status, {
          "content-type": candidate.contentType,
          "cache-control": cacheControl,
          ...SECURITY_HEADERS,
        });
        response.end(candidate.body);
        return;
      }

      const shell = serveFile(path.join(config.distDir, "index.html"), "no-cache");
      if (!shell) {
        await writeFetchResponse(json({ error: "Not found." }, 404), response);
        return;
      }
      response.writeHead(shell.status, {
        "content-type": shell.contentType,
        "cache-control": shell.cacheControl,
        ...SECURITY_HEADERS,
      });
      response.end(shell.body);
    } catch (error) {
      // Safe error handling: no internals, no secrets in the response.
      console.error("[ry-mark] Request error:", error instanceof Error ? error.message : error);
      if (!response.headersSent) {
        await writeFetchResponse(json({ error: "Internal server error." }, 500), response);
      } else {
        response.end();
      }
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(`[ry-mark] Listening on http://${config.host}:${config.port}`);
  });

  const shutdown = () => {
    console.log("\n[ry-mark] Shutting down.");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[ry-mark] Fatal startup error:", error);
  process.exit(1);
});

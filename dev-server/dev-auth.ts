/**
 * Local development auth middleware for `vite dev` and `vite preview`.
 *
 * This middleware is NOT part of any deployment: it emulates the /api/auth/*
 * endpoints and /healthz locally using the SAME shared auth-core as the
 * Cloudflare worker and the Node server, so the login flow can be exercised
 * during development exactly as it behaves in production.
 *
 * Environment is read from .dev.vars (see .dev.vars.example). When no
 * .dev.vars exists, a documented dev-only default is used so the project can
 * boot out of the box (development machines only — never deployed).
 */
import fs from "node:fs";
import path from "node:path";
import type { Connect, Plugin as VitePlugin } from "vite";
import { AuthService } from "../shared/auth-core/index.js";

interface DevVars {
  [key: string]: string;
}

function loadDevVars(cwd: string): DevVars {
  const filePath = path.join(cwd, ".dev.vars");
  const vars: DevVars = {
    AUTH_ENABLED: "true",
    PASSWORD_HASH: "",
    SESSION_SECRET: "",
  };
  if (fs.existsSync(filePath)) {
    const contents = fs.readFileSync(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === "" || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      vars[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return vars;
  }
  // Documented dev-only fallback so `npm run dev` boots without setup:
  // password is "rymark-dev", hash generated with the production KDF.
  vars.PASSWORD_HASH =
    "pbkdf2-sha256$100000$0lDgrHV9tIm0cSZSNzvzDQ$AcL8B0vFRr5d0gUzuD-RCZGvcnTiH1nS_VYSDURqNa4";
  vars.SESSION_SECRET = "dev-only-session-secret-please-change-me-1234567890";
  return vars;
}

export function createDevAuthMiddleware(): Connect.NextHandleFunction {
  const devVars = loadDevVars(process.cwd());
  const authService = new AuthService(devVars);

  return async (request, response, next) => {
    const pathname = (request.url ?? "/").split("?")[0]!;

    try {
      if (pathname === "/healthz") {
        response.statusCode = 200;
        response.setHeader("content-type", "text/plain");
        response.end("ok");
        return;
      }

      if (pathname.startsWith("/api/auth/")) {
        const url = new URL(request.url ?? "/", "http://localhost");
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (typeof value === "string") headers.set(name, value);
          else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
        }
        const body =
          request.method === "POST"
            ? await new Promise<string>((resolve) => {
                const chunks: Buffer[] = [];
                request.on("data", (chunk: Buffer) => chunks.push(chunk));
                request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
                request.on("error", () => resolve(""));
              })
            : undefined;

        const fetchRequest = new Request(url, {
          method: request.method,
          headers,
          body,
        });
        const authResponse = await authService.handleAuthApi(fetchRequest);
        if (authResponse) {
          response.statusCode = authResponse.status;
          authResponse.headers.forEach((value, name) => response.setHeader(name, value));
          const setCookies = authResponse.headers.getSetCookie?.() ?? [];
          if (setCookies.length > 0) {
            response.removeHeader("set-cookie");
            response.setHeader("set-cookie", setCookies);
          }
          response.end(Buffer.from(await authResponse.arrayBuffer()));
          return;
        }
      }
    } catch (error) {
      console.error("[rymark-dev-auth] Middleware error:", error);
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: "Dev auth middleware error." }));
      return;
    }

    next();
  };
}

export function devAuthPlugin(): VitePlugin {
  return {
    name: "rymark-dev-auth",
    configureServer(server) {
      server.middlewares.use(createDevAuthMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createDevAuthMiddleware());
    },
  };
}

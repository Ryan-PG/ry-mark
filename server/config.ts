/**
 * Self-hosted adapter environment configuration.
 *
 * Loads a .env file (if present) into process.env without any dependency,
 * then exposes the same secret/variable contract as the Cloudflare adapter:
 *
 *   AUTH_ENABLED      optional; "false" disables auth (default: enabled)
 *   PASSWORD_HASH     required when auth is enabled (see npm run hash:password)
 *   SESSION_SECRET    required when auth is enabled (min 32 chars)
 *   SESSION_TTL_HOURS optional; session lifetime in hours (default: 168 = 7 days)
 *   PORT              optional; listening port (default: 8080)
 *   HOST              optional; bind address (default: 0.0.0.0)
 *   DIST_DIR          optional; override for the built frontend directory
 */
import fs from "node:fs";
import path from "node:path";
import { isAuthEnabled, type SecretEnv, type SessionOptions } from "../shared/auth-core/index.js";

const DEFAULT_PORT = 8080;
const DEFAULT_SESSION_TTL_HOURS = 168;

/** Minimal .env loader: KEY=VALUE lines, # comments, optional quotes. */
export function loadDotEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export interface ServerConfig {
  readonly env: SecretEnv;
  readonly port: number;
  readonly host: string;
  readonly distDir: string;
  readonly contentDir: string;
  readonly sessionOptions: Partial<SessionOptions>;
  readonly authEnabled: boolean;
}

export function createServerConfig(cwd: string = process.cwd()): ServerConfig {
  loadDotEnv(path.join(cwd, ".env"));

  const distDir = path.resolve(
    cwd,
    process.env.DIST_DIR && process.env.DIST_DIR.trim() !== "" ? process.env.DIST_DIR : "dist",
  );
  const contentDir = path.join(distDir, "content");

  const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const ttlHours = Number.parseFloat(process.env.SESSION_TTL_HOURS ?? String(DEFAULT_SESSION_TTL_HOURS));
  const sessionTtlSeconds =
    Number.isFinite(ttlHours) && ttlHours > 0 ? Math.floor(ttlHours * 3600) : DEFAULT_SESSION_TTL_HOURS * 3600;

  const authEnabled = isAuthEnabled(process.env.AUTH_ENABLED);

  // Only pass the secrets the auth core needs. Nothing secret is ever
  // exposed to the frontend or logged.
  const env: SecretEnv = {
    AUTH_ENABLED: process.env.AUTH_ENABLED,
    PASSWORD_HASH: process.env.PASSWORD_HASH,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };

  return {
    env,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    host: process.env.HOST?.trim() || "0.0.0.0",
    distDir,
    contentDir,
    sessionOptions: { ttlSeconds: sessionTtlSeconds },
    authEnabled,
  };
}

/**
 * Minimal ambient declarations for the Cloudflare Pages advanced-mode worker
 * runtime. Only the pieces Ry-Mark uses are declared; full types come from
 * the platform at runtime.
 */
declare interface PagesAssetsBinding {
  fetch(request: Request | string): Promise<Response>;
}

declare interface RyMarkWorkerEnv {
  /** Binding to the Pages static asset store. */
  ASSETS: PagesAssetsBinding;
  /** Encrypted Cloudflare secret (never exposed to the frontend). */
  PASSWORD_HASH?: string;
  /** Encrypted Cloudflare secret (never exposed to the frontend). */
  SESSION_SECRET?: string;
  /** Plain environment variable. Missing/invalid defaults to enabled. */
  AUTH_ENABLED?: string;
  /** Optional plain environment variable: session lifetime in hours. */
  SESSION_TTL_HOURS?: string;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

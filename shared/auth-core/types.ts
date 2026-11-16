/**
 * Shared auth-core types.
 *
 * This module is runtime-agnostic: it must only rely on standard Web Crypto
 * APIs (available in Cloudflare Workers, Node.js >= 20, and all modern
 * browsers) so that every deployment adapter can reuse it unchanged.
 */

/** High-level authentication configuration state, evaluated at runtime. */
export type AuthConfigState =
  /** AUTH_ENABLED=false: content is public, no secrets required. */
  | "disabled"
  /** Auth enabled and both secrets are present and well-formed. */
  | "ok"
  /** Auth enabled but PASSWORD_HASH is missing: fail closed, show setup screen. */
  | "unconfigured"
  /** Auth enabled but PASSWORD_HASH exists and is malformed: fail closed. */
  | "malformed"
  /** Auth enabled but SESSION_SECRET is missing (valid password hash present). */
  | "missing-session-secret";

/** Result of evaluating the runtime environment for authentication. */
export interface AuthEvaluation {
  readonly enabled: boolean;
  readonly state: AuthConfigState;
  /**
   * Human-readable explanation for non-`ok` states. Never contains secret
   * material — only configuration facts.
   */
  readonly message?: string;
}

/** Parsed PASSWORD_HASH in the Ry-Mark versioned hash format. */
export interface ParsedPasswordHash {
  /** KDF identifier, e.g. "pbkdf2-sha256". */
  readonly algorithm: string;
  /** KDF work factor (iteration count). */
  readonly iterations: number;
  /** Base64url-decoded random salt. */
  readonly salt: Uint8Array;
  /** Base64url-decoded derived key. */
  readonly derivedKey: Uint8Array;
}

/** Result of a password verification attempt. */
export type VerifyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid" | "error" };

/** Signed session payload stored inside the session cookie. */
export interface SessionPayload {
  /** Format version. */
  readonly v: 1;
  /** Issued-at: unix epoch seconds. */
  readonly iat: number;
  /** Expiration: unix epoch seconds. */
  readonly exp: number;
  /**
   * Random per-session identifier. Allows independent sessions per browser
   * without any shared server-side state.
   */
  readonly sid: string;
}

/** Options controlling session lifetime and cookie flags. */
export interface SessionOptions {
  /** Session lifetime in seconds (default: 7 days). */
  readonly ttlSeconds: number;
  /** Cookie name. */
  readonly cookieName: string;
  /** Whether the cookie gets the `Secure` attribute. */
  readonly secureCookie: boolean;
  /** SameSite attribute value. */
  readonly sameSite: "Lax" | "Strict";
}

export interface VerifiedSession {
  readonly payload: SessionPayload;
}

/** Environment-style accessor shared by all adapters. */
export type SecretEnv = Record<string, string | undefined>;

/** Public (non-secret) shape returned by GET /api/auth/status. */
export interface AuthStatusResponse {
  readonly enabled: boolean;
  readonly state: AuthConfigState;
  readonly authenticated: boolean;
  /** Present when state indicates a configuration problem. */
  readonly message?: string;
}

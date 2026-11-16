/**
 * Authentication configuration evaluation.
 *
 * Ry-Mark fails closed: unless authentication is explicitly disabled with
 * AUTH_ENABLED=false, content is never served without a valid session, and a
 * missing or malformed PASSWORD_HASH never falls back to a public site.
 */
import type { AuthEvaluation, SecretEnv } from "./types.js";
import { parseHash } from "./password.js";

/**
 * Parses the AUTH_ENABLED environment value.
 * Missing or invalid values default to enabled (fail-closed); the literal
 * string "false" (case-insensitive) is the only way to disable auth.
 */
export function isAuthEnabled(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null) return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== "false";
}

/**
 * Evaluates the environment into a high-level configuration state.
 * Never exposes secret values — messages describe configuration facts only.
 */
export function evaluateAuthConfig(env: SecretEnv): AuthEvaluation {
  const enabled = isAuthEnabled(env.AUTH_ENABLED);

  if (!enabled) {
    return { enabled: false, state: "disabled" };
  }

  const passwordHash = env.PASSWORD_HASH?.trim();
  const sessionSecret = env.SESSION_SECRET?.trim();

  if (!passwordHash) {
    return {
      enabled: true,
      state: "unconfigured",
      message:
        "PASSWORD_HASH is not configured. The administrator must run `npm run hash:password` " +
        "and store the result as an encrypted secret named PASSWORD_HASH.",
    };
  }

  if (!parseHash(passwordHash)) {
    return {
      enabled: true,
      state: "malformed",
      message:
        "PASSWORD_HASH is malformed or uses an unsupported format. Regenerate it with " +
        "`npm run hash:password` and replace the PASSWORD_HASH secret.",
    };
  }

  if (!sessionSecret) {
    return {
      enabled: true,
      state: "missing-session-secret",
      message:
        "SESSION_SECRET is not configured. Generate a long random value and store it as an " +
        "encrypted secret named SESSION_SECRET.",
    };
  }

  if (sessionSecret.length < 32) {
    return {
      enabled: true,
      state: "missing-session-secret",
      message:
        "SESSION_SECRET is too short (minimum 32 characters). Regenerate it as a long random value.",
    };
  }

  return { enabled: true, state: "ok" };
}

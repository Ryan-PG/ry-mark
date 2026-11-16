/**
 * Canonical Ry-Mark password hash implementation (plain ESM, dependency-free).
 *
 * IMPORTANT: this module must produce exactly the hash format that
 * shared/auth-core/password.ts verifies at runtime. The equivalence is
 * enforced by tests in tests/auth-core.test.ts, which verify that hashes
 * generated here pass the auth-core verifier and vice versa.
 *
 * Format: pbkdf2-sha256$<iterations>$<base64url-salt>$<base64url-dk>
 */
export const PBKDF2_ALGORITHM = "pbkdf2-sha256";
export const DEFAULT_ITERATIONS = 100_000;
export const KEY_LENGTH_BYTES = 32;
export const SALT_LENGTH_BYTES = 16;

const encoder = new TextEncoder();

export function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
}

export async function deriveKey(password, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    baseKey,
    KEY_LENGTH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export function formatHash({ iterations, salt, derivedKey }) {
  return [PBKDF2_ALGORITHM, String(iterations), toBase64Url(salt), toBase64Url(derivedKey)].join("$");
}

/** Generates a complete hash string from a plaintext password. */
export async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const salt = generateSalt();
  const derivedKey = await deriveKey(password, salt, iterations);
  return formatHash({ iterations, salt, derivedKey });
}

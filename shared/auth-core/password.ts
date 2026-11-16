/**
 * Versioned password hashing utilities built exclusively on the Web Crypto
 * SubtleCrypto API so the exact same code runs on Cloudflare Workers and
 * Node.js (>= 20 has globalThis.crypto.subtle).
 *
 * Hash format (v1):
 *
 *   pbkdf2-sha256$<iterations>$<base64url-salt>$<base64url-derived-key>
 *
 * Rationale for PBKDF2-HMAC-SHA256:
 * - Cloudflare Workers does not ship Argon2 in Web Crypto, and pure-JS Argon2
 *   is too slow / CPU-expensive for the Workers runtime (see docs/AUTHENTICATION.md).
 * - PBKDF2 is a well-established, NIST-approved password KDF with native,
 *   constant-memory implementations in both target runtimes.
 * - The iteration count is embedded in the hash, so work factors can be
 *   raised over time without breaking old hashes.
 */
import type { ParsedPasswordHash, VerifyResult } from "./types.js";

export const PBKDF2_ALGORITHM = "pbkdf2-sha256";
/** Default work factor. See docs/AUTHENTICATION.md for runtime benchmarks. */
export const DEFAULT_ITERATIONS = 100_000;
export const KEY_LENGTH_BYTES = 32;
export const SALT_LENGTH_BYTES = 16;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Serializes hash parameters into the canonical hash string format. */
export function formatHash(hash: {
  iterations: number;
  salt: Uint8Array;
  derivedKey: Uint8Array;
}): string {
  return [
    PBKDF2_ALGORITHM,
    String(hash.iterations),
    toBase64Url(hash.salt),
    toBase64Url(hash.derivedKey),
  ].join("$");
}

/**
 * Parses a stored password hash.
 * Returns null when the value is missing or malformed (never throws on
 * attacker-controlled input).
 */
export function parseHash(value: string | undefined | null): ParsedPasswordHash | null {
  if (!value) return null;
  const parts = value.trim().split("$");
  if (parts.length !== 4) return null;
  const [algorithm, iterationsRaw, saltRaw, keyRaw] = parts;
  if (algorithm !== PBKDF2_ALGORITHM) return null;
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 10_000_000) return null;
  try {
    const salt = fromBase64Url(saltRaw);
    const derivedKey = fromBase64Url(keyRaw);
    if (salt.length < 8 || derivedKey.length < 16) return null;
    return { algorithm, iterations, salt, derivedKey };
  } catch {
    return null;
  }
}

/** Derives a PBKDF2-HMAC-SHA256 key from a password and salt. */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // deriveBits (not deriveKey) so the output cannot be used as a CryptoKey.
  // The cast bridges TS's Uint8Array<ArrayBufferLike> ↔ BufferSource variance;
  // at runtime a Uint8Array is always a valid BufferSource.
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as Uint8Array<ArrayBuffer>, iterations },
    baseKey,
    KEY_LENGTH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Constant-time byte comparison. Both implementations of compare are
 * branchless with respect to the compared data.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Verifies a plaintext password against a stored hash string.
 * Malformed hashes always fail closed (`ok: false`), never throw.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | undefined | null,
): Promise<VerifyResult> {
  const parsed = parseHash(storedHash);
  if (!parsed) return { ok: false, reason: "invalid" };
  try {
    const candidate = await deriveKey(password, parsed.salt, parsed.iterations);
    const match = constantTimeEqual(candidate, parsed.derivedKey);
    return match ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Generates a cryptographically secure random salt. */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
}

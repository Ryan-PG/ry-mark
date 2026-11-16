/**
 * Stateless HMAC-signed sessions.
 *
 * No database or KV store is used: each session is a self-contained token
 * signed with SESSION_SECRET (HMAC-SHA256 over Web Crypto). Rotation of
 * SESSION_SECRET instantly invalidates all previously issued sessions.
 * Every browser receives an independent token (random sid), so logging out
 * one browser never affects another.
 */
import type { SessionPayload, SessionOptions, VerifiedSession } from "./types.js";

export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const DEFAULT_COOKIE_NAME = "rymark_session";

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

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

function defaultOptions(options?: Partial<SessionOptions>): SessionOptions {
  return {
    ttlSeconds: options?.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS,
    cookieName: options?.cookieName ?? DEFAULT_COOKIE_NAME,
    secureCookie: options?.secureCookie ?? true,
    sameSite: options?.sameSite ?? "Lax",
  };
}

/** Creates a fresh signed session token for a new login. */
export async function createSessionToken(
  secret: string,
  options?: Partial<SessionOptions>,
): Promise<{ token: string; payload: SessionPayload }> {
  const opts = defaultOptions(options);
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: now,
    exp: now + opts.ttlSeconds,
    sid: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(secret, body));
  return { token: `${body}.${signature}`, payload };
}

/**
 * Verifies a session token: checks HMAC signature (constant-time), payload
 * structure, and expiration. Returns null for any tampered, malformed or
 * expired input.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string | undefined,
): Promise<VerifiedSession | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;
  try {
    const expected = await hmac(secret, body);
    const provided = fromBase64Url(signature);
    if (!constantTimeEqual(expected, provided)) return null;
    const decoded = new TextDecoder().decode(fromBase64Url(body));
    const payload = JSON.parse(decoded) as SessionPayload;
    if (
      payload?.v !== 1 ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.sid !== "string" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { payload };
  } catch {
    return null;
  }
}

/** Builds the Set-Cookie header value for a freshly issued session. */
export function buildSessionCookie(token: string, options?: Partial<SessionOptions>): string {
  const opts = defaultOptions(options);
  const attributes = [
    `${opts.cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    `Max-Age=${opts.ttlSeconds}`,
  ];
  if (opts.secureCookie) attributes.push("Secure");
  return attributes.join("; ");
}

/** Builds the Set-Cookie header value that clears the session cookie. */
export function buildClearSessionCookie(options?: Partial<SessionOptions>): string {
  const opts = defaultOptions(options);
  const attributes = [
    `${opts.cookieName}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
    "Max-Age=0",
  ];
  if (opts.secureCookie) attributes.push("Secure");
  return attributes.join("; ");
}

/** Extracts the session cookie value from a request Cookie header. */
export function readSessionCookie(
  cookieHeader: string | undefined | null,
  cookieName: string = DEFAULT_COOKIE_NAME,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name === cookieName) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

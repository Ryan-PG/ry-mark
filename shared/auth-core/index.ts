/**
 * Ry-Mark shared authentication core.
 *
 * See docs/AUTHENTICATION.md for the design. Every deployment adapter
 * (Cloudflare Pages advanced-mode worker, self-hosted Node server, local dev
 * middleware) must use this package — never reimplement auth logic locally.
 */
export * from "./types.js";
export * from "./config.js";
export * from "./password.js";
export * from "./session.js";
export * from "./ratelimit.js";
export * from "./service.js";

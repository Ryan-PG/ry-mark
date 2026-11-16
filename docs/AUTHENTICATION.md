# Authentication

Ry-Mark uses **one shared password** for all users, signed stateless sessions, and a fail-closed configuration model. This document covers the design; setup instructions are in [PASSWORD-SETUP.md](./PASSWORD-SETUP.md).

## Overview

```text
 login (password) ──► PBKDF2-SHA-256 verify (constant-time)
        │ success
        ▼
 HMAC-signed session token ──► HttpOnly / Secure / SameSite=Lax / Path=/ cookie
        │ every request to /content/*
        ▼
 auth gate: cookie verified (signature + expiration) ──► content served
```

All logic lives in `shared/auth-core/` and is used **unchanged** by the Cloudflare worker, the self-hosted Node server, and the local dev middleware. There is no auth code outside that directory.

## `AUTH_ENABLED` toggle

| Value | Behavior |
| --- | --- |
| `true` / missing / any invalid value | Authentication **enabled** (fail closed) |
| `false` (case-insensitive) | All content public; `PASSWORD_HASH`/`SESSION_SECRET` not required |

## `PASSWORD_HASH` — password hashing

### Algorithm choice

**PBKDF2-HMAC-SHA-256**, via Web Crypto `deriveBits`.

Why not Argon2id? Cloudflare Workers does not implement Argon2 in Web Crypto, and a pure-JS Argon2 implementation would blow the Workers CPU budget (the algorithm is intentionally memory-hard). PBKDF2 is a well-established password KDF with native, constant-memory implementations in both Cloudflare's runtime and Node.js — the only portable choice across our two deployment targets.

### Hash format (versioned)

```text
pbkdf2-sha256$<iterations>$<base64url-salt>$<base64url-derived-key>
```

- Unique 16-byte CSPRNG salt per hash.
- 32-byte derived key.
- Iteration count is **embedded in the hash**, so you can strengthen it later by regenerating; old hashes keep verifying.
- Defaults: **100,000 iterations** (see cost analysis below).

### Runtime cost on Cloudflare

Web Crypto PBKDF2 in Workers is implemented natively; measured community benchmarks put 100k PBKDF2-SHA-256 iterations in the tens-of-milliseconds range on Workers hardware.

| Plan | CPU limit per request | 100k iterations | Verdict |
| --- | --- | --- | --- |
| Workers Paid (Pages Pro) | 50 ms default (configurable) | ~20–50 ms | Recommended; comfortable |
| Free plan | 10 ms | over budget | Use ≤ 30k iterations, or upgrade, or use Cloudflare Access |

**We do not silently weaken hashing to fit the free plan.** If you must stay on the free plan, lower the iteration count explicitly when generating (`npm run hash:password` embeds whatever count is compiled in — the default is 100k) and accept the reduced work factor, or prefer Cloudflare Access in front of the deployment for production use. The verifier accepts any iteration count in the hash, so raising it later requires only re-running the generator and updating the secret.

Login is rate-limited (below), which caps how much verification CPU an attacker can consume regardless of plan.

### Verification properties

- Constant-time comparison of derived keys (no early exit on first differing byte).
- Malformed or missing hashes fail closed (`ok: false`), never throw, never bypass.
- The plaintext password is never logged or stored anywhere.

## `SESSION_SECRET` — sessions

- HMAC-SHA256 over a base64url payload; signature compared in constant time.
- Payload: `{ v: 1, iat, exp, sid }`; `sid` is 16 random bytes per session.
- Cookie: `rymark_session` — `HttpOnly`, `Secure` (auto-enabled on HTTPS, incl. behind a proxy that sets `X-Forwarded-Proto: https`), `SameSite=Lax`, `Path=/`, `Max-Age = TTL`.
- Default TTL: **7 days** (168 h). Override with `SESSION_TTL_HOURS` (both adapters).
- Rotation: changing `SESSION_SECRET` instantly invalidates all previously issued sessions.
- No `localStorage` or any client-side token storage is used.

Multiple users/browsers: every login mints an independent token with its own `sid` and `exp`; logout clears only that browser's cookie. Changing `PASSWORD_HASH` changes the shared password for new logins; existing sessions stay valid until expiry unless you also rotate `SESSION_SECRET`.

## Endpoints

| Method | Path | Auth required | Behavior |
| --- | --- | --- | --- |
| GET | `/api/auth/status` | no | `{ enabled, state, authenticated }` — no secret data |
| POST | `/api/auth/login` | no | Body `{ password }`; success sets cookie; 401 wrong password; 429 rate limited; 503 when misconfigured |
| POST | `/api/auth/logout` | no | Clears the cookie (`Max-Age=0`) |
| GET | `/api/auth/session` | cookie | `{ authenticated, expiresAt }` or 401 |

Request validation: JSON only, ≤ 4 KB, password ≤ 1024 chars. Errors are uniform JSON without internal details.

## Rate limiting

- 5 failed attempts per 10 minutes per client IP (sliding window, in-memory).
- Successful logins reset the counter for that IP.
- **Honest limitation:** on Cloudflare, memory is per-isolate, so this limiter is not globally consistent across edge locations. It still stops most casual brute-force bursts. For hard, global guarantees, add a Cloudflare WAF rate-limiting rule on `POST /api/auth/login` (one click in the dashboard, works on all plans). The self-hosted Node adapter is a single process, so the limiter is exact there.

## What content is protected?

Everything under `/content/`:

- Markdown sources (`.md`)
- HTML documents (`.html`) — including assets they reference
- Images and any other assets
- `manifest.json` (navigation)
- `search-index.json` (search corpus)

Direct URL access without a session returns `401` (API/asset-like requests) or redirects to the app shell (`302` → login/setup screen). This is enforced **by the request interceptor itself** (Cloudflare advanced-mode worker / Node middleware), not by anything the browser could bypass. The public shell contains no content data.

On Cloudflare this is only possible in **advanced mode**: normal Pages Functions run *after* static assets are served, so a `functions/` catch-all cannot protect build-output files. See `ARCHITECTURE.md` §D1.

## Fail-closed states (`GET /api/auth/status`)

| State | Meaning | UI |
| --- | --- | --- |
| `disabled` | `AUTH_ENABLED=false` | Full app, no auth |
| `ok` | Configured correctly | Login → app |
| `unconfigured` | `PASSWORD_HASH` missing | **Setup screen** (login form hidden) with exact remediation steps |
| `malformed` | `PASSWORD_HASH` unparsable | **Configuration error screen** with regeneration instructions |
| `missing-session-secret` | `SESSION_SECRET` missing/short | Configuration error screen |

Secret values are never revealed in any UI, response, or log line.

## Threat model summary

| Threat | Mitigation |
| --- | --- |
| Brute-force password | PBKDF2 work factor + per-IP rate limiting + (optional) WAF rule |
| Session forgery | HMAC with server-only secret, constant-time compare |
| Session theft | HttpOnly + Secure cookies; TLS required in production |
| Direct content URL access | Adapter-level gate on every request (tested) |
| Path traversal | Path normalization + prefix containment (tested) |
| XSS via markdown | Raw HTML disabled; rehype-sanitize allowlist; CSP on shell |
| Embedded HTML escaping | iframe sandbox `allow-scripts` only (opaque origin) |
| Secret leakage | Secrets only in adapter env; excluded from bundle, logs, and git |

# Security

Ry-Mark's security model, controls, and their verification. Read together with [AUTHENTICATION.md](./AUTHENTICATION.md).

## Principles

1. **Fail closed** — any missing/malformed security configuration locks content; nothing degrades to public.
2. **Minimum surface** — auth endpoints + gated content prefix + health check. No database, no mutations, no dynamic code.
3. **Defense in depth** — the browser cannot bypass anything, because the gate is enforced by the request interceptor in every environment.
4. **Least privilege** — secrets only in adapter runtime env; iframes run sandboxed; CSP restricts the shell.

## Controls

### Authentication & sessions

- Password stored as PBKDF2-SHA-256 (100k iterations default, unique salt, versioned format); verification constant-time.
- Sessions: HMAC-SHA256 signed tokens, constant-time signature check, expiration checked on every protected request.
- Cookie: `HttpOnly` (no JS access), `Secure` (HTTPS/proxy-aware), `SameSite=Lax`, `Path=/`.
- Rate limiting: 5 failures / 10 min / IP; `429` + `Retry-After`; success resets. Workers limitation (per-isolate memory) documented; Cloudflare WAF rule recommended for hard guarantees.
- Plaintext passwords never logged/stored; secrets never appear in responses or logs.

### Content access

- **All** of `/content/*` is gated: `.md` sources, `.html` docs, images, manifest, search index.
- Path handling: decode → normalize → prefix containment; traversal, encoded and NUL variants rejected (tested in `tests/adapters.test.ts`).
- Unauthenticated direct URLs: `401` (asset-like) or `302` to the shell (browser navigation) — never content, never directory existence hints.
- Cloudflare protection relies on advanced-mode `_worker.js` intercepting all requests (standard Functions run after static assets and cannot protect build output).

### Browser isolation

- **App shell CSP**: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (React inline styles), `img-src 'self' data: https:` (documentation images), `frame-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- **HTML documents**: rendered in an iframe with `sandbox="allow-scripts"` only — opaque origin; no DOM/cookie/storage access to the parent app; no `allow-same-origin`, `allow-forms`, `allow-popups`, or top navigation.
- **Markdown**: raw HTML disabled (react-markdown default) + `rehype-sanitize` allowlist schema + CSP; KaTeX renders after sanitization.
- **External links**: `target="_blank" rel="noopener noreferrer"`.
- Content responses carry `X-Content-Type-Options: nosniff` and a no-referrer policy.

### Headers (shell + content)

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin` (content: `no-referrer`)
- `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin` (shell)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Secret hygiene

- `PASSWORD_HASH` / `SESSION_SECRET` exist only as Cloudflare encrypted Secrets or in `.env` / `.dev.vars` (git-ignored; `.example` files contain placeholders only).
- Never in Vite `import.meta.env`, client bundles, HTML, logs, or test fixtures with real values (test hashes use throwaway passwords and 1000 iterations).
- No hardcoded credentials anywhere in the repo.
- Rotating `SESSION_SECRET` invalidates all sessions; regenerating `PASSWORD_HASH` changes the shared password.

## Known limitations (honest disclosure)

- **In-memory rate limiting on Cloudflare** is per-isolate — not a global guarantee. Mitigate with a dashboard WAF rule on `POST /api/auth/login`.
- **PBKDF2 on the Workers free plan** cannot afford a high work factor within the 10 ms CPU limit; see the plan matrix in AUTHENTICATION.md and consider Cloudflare Access for high-security needs.
- **HTML documents execute JavaScript** (by design, in a sandbox). They are trusted project content, but treat them like code: review what you commit, since they run with scripting enabled in a unique origin.
- **Search excerpts and titles are gated with content** — no metadata leaks, but note the search index ships inside the protected prefix, adding ~KB-scale payloads to authenticated loads.

## Reporting

This project has no bug bounty. If you find a vulnerability, open a private security advisory or contact the maintainers directly; do not open a public issue with exploitable details.

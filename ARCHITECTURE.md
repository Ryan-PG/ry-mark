# Architecture

## System shape

```text
                        ┌────────────────────────────────────────────┐
                        │              Build pipeline                │
                        │                                            │
 content/  ──► scripts/build-content.mjs ──► public/content/         │
             (manifest.json, search-index.json, file sync)           │
 src/      ──► Vite ──► dist/ (SPA + synced content)                 │
 worker/   ──► esbuild ──► dist/_worker.js (Cloudflare adapter)       │
 server/   ──► tsc ──► dist-server/ (Node adapter)                   │
                        └────────────────────────────────────────────┘

 Request flow (both targets behave identically):

   browser ──► adapter (worker / node server)
                 ├─ /api/auth/*  ──► shared/auth-core (rate limited)
                 ├─ /healthz     ──► public 200
                 ├─ /content/*   ──► auth gate ──► static content
                 └─ everything else ──► SPA shell (public)
```

## Layers and dependency direction

Dependencies point strictly downward; nothing imports upward.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ src/ (React SPA)                                                    │
│   App shell, sidebar, search, document view, auth screens           │
│   imports only ▼                                                    │
│   features/document-rendering/index.ts   (public API of rendering)  │
├─────────────────────────────────────────────────────────────────────┤
│ features/document-rendering                                         │
│   core/        renderer registry + adapter (stable interface)       │
│   components/  DocumentViewer (kind switch), HtmlDocument (iframe)  │
│   engines/react-markdown/   THE ONLY PLACE react-markdown is used   │
├─────────────────────────────────────────────────────────────────────┤
│ lib/api.ts       fetch clients for /api/auth/* and /content/*       │
├─────────────────────────────────────────────────────────────────────┤
│ shared/auth-core  (runtime-agnostic TS, Web Crypto only)            │
│   config.ts password.ts session.ts ratelimit.ts service.ts          │
│   ▲ imported by all three adapters — zero duplication               │
├──────────────────────────────────┬──────────────────────────────────┤
│ worker/entry.ts (Cloudflare)     │ server/*.ts (Node self-hosted)   │
│ bundled to dist/_worker.js       │ compiled to dist-server/         │
└──────────────────────────────────┴──────────────────────────────────┘
```

## Key architectural decisions

### D1 — Advanced-mode Cloudflare worker (`dist/_worker.js`)

In standard Cloudflare Pages routing, static assets are served **before** Functions run, so even a `functions/[[path]].js` catch-all cannot protect files that exist in the build output. Since Ry-Mark's content (`.md` sources, `.html` documents, images, manifest, search index) is part of the build output, the worker must intercept **every** request. Advanced mode does exactly that; the worker routes via `env.ASSETS.fetch(request)`.

Verified against Cloudflare's routing documentation (see `docs/DEPLOYMENT.md`, references section).

### D2 — One shared authentication core

`shared/auth-core/` implements password verification, session signing, cookie handling, configuration evaluation, rate limiting, and the complete `/api/auth/*` service in runtime-agnostic TypeScript over Web Crypto. The Cloudflare worker, the Node server, and the dev middleware hand it standard `Request` objects; none of them contain auth logic. Equivalent behavior across deployment targets is enforced by shared tests (`tests/adapters.test.ts`, `tests/auth-core.test.ts`).

### D3 — PBKDF2-SHA-256 as the password KDF

Cloudflare Workers' Web Crypto does not provide Argon2, and pure-JS Argon2 is unusably slow/CPU-heavy in the Workers runtime. PBKDF2-HMAC-SHA-256 is natively implemented in both target runtimes with constant-memory performance. The hash embeds its iteration count (`pbkdf2-sha256$<iterations>$<salt>$<dk>`) so work factors can be raised without migration. Full rationale and runtime-cost discussion: `docs/AUTHENTICATION.md`.

### D4 — Stateless signed sessions

Sessions are self-contained HMAC-SHA256 tokens in an `HttpOnly` cookie (`v`, `iat`, `exp`, random `sid`). No server-side session store exists, so:

- multiple browsers/users hold independent sessions simultaneously;
- logout affects only one browser's cookie;
- rotating `SESSION_SECRET` invalidates every issued session at once;
- no database or KV is ever needed.

### D5 — Replaceable Markdown renderer

`DocumentViewer` and everything above it know only the `MarkdownRenderProps` interface and the registry. The react-markdown engine lives in an engine module loaded lazily via the registry; swapping engines means implementing one component and changing one registration entry in `bootstrap.ts`. The HTML renderer (`IsolatedHtmlIframe`) is fully independent of any Markdown machinery.

### D6 — Build-time content manifest + search index

Browsers cannot enumerate server directories, so `scripts/build-content.mjs` scans `content/`, sanitizes relative paths (rejecting traversal/hidden entries), extracts titles and search text, and emits `manifest.json` + `search-index.json` into the protected `/content/` prefix. The SPA bundle contains **no** content metadata, so nothing leaks through the public shell.

### D7 — HTML documents as real documents

`.html` files are never parsed. They are served from their original `/content/...` URL inside an iframe with `sandbox="allow-scripts"` (opaque origin). Relative CSS/images/scripts work because the iframe loads the real URL with the session cookie attached; the embedded document cannot touch the parent app, cookies, or storage.

### D8 — Dual deployment adapters over one artifact

The same `dist/` (frontend + content + manifest + index) is served by both adapters. The worker is a Cloudflare-only artifact (`_worker.js`), the Node server is a Cloudflare-independent artifact; the frontend is shared byte-for-byte.

## Request lifecycle: opening a document

1. `GET /` → adapter serves `index.html` (public shell, strict CSP).
2. SPA calls `GET /api/auth/status` → auth gate decides: `public`, `authenticated`, `login`, `unconfigured`, `malformed`, `missing-session-secret`.
3. Only in the OK/public cases does the SPA fetch `/content/manifest.json` (auth-gated).
4. Sidebar renders from the manifest; route `/doc/<path>` loads `/content/<path>` (raw markdown) and passes it to the renderer adapter.
5. HTML documents skip step 4: the iframe loads the real URL directly.

## Failure behavior matrix

| Condition | Result |
| --- | --- |
| `PASSWORD_HASH` missing | Setup screen, login form hidden, all content gated |
| `PASSWORD_HASH` malformed | Configuration-error screen, content gated |
| `SESSION_SECRET` missing/short | Configuration-error screen, content gated |
| `AUTH_ENABLED=false` | Content public, secrets not required |
| Expired/tampered session cookie | Content gate returns 401/redirect |
| Content path escapes root | 404, never served |
| Manifest/search-index fetch fails | Shell renders error state; no unlock |

## Bundle strategy

- React/router in a shared chunk; the Markdown engine (react-markdown + plugins) is a lazy chunk loaded on first document view.
- Shiki (~large) loads only when a code block is rendered; Mermaid only when a diagram appears.
- KaTeX CSS ships with the engine chunk.
- The shell stays small so the setup/login screens paint fast.

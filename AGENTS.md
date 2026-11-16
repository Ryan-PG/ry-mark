# AGENTS.md — Instructions for AI Agents and Contributors

**Read this file before modifying anything in this repository.** It defines the architecture, conventions, and constraints that keep Ry-Mark secure, maintainable, and deployable.

## Project overview

Ry-Mark is a read-only, password-protected Markdown & HTML documentation viewer. It runs on two first-class deployment targets:

1. **Cloudflare Pages** (advanced-mode `_worker.js` built from `worker/entry.ts`)
2. **Self-hosted Node.js** (dependency-free server in `server/`, Docker-ready)

Both targets share:

- The same frontend build (`dist/`, built by Vite from `src/`)
- The same content manifest (`content/` → `public/content/` via `scripts/build-content.mjs`)
- The same Markdown renderer (registered through the renderer registry)
- The same authentication core (`shared/auth-core/`)

There is **no database, no editing UI, no upload system, and no business API**. The only server-side surface is authentication (`/api/auth/*`), a health check (`/healthz`), and the auth-gated content prefix (`/content/*`).

## Technology stack

- React 19 + TypeScript (strict) + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`), CSS-variable design tokens in `src/index.css`
- shadcn/ui-style components (hand-authored in `src/components/ui/`, Radix primitives)
- react-markdown + remark/rehype pipeline (see `docs/MARKDOWN-RENDERING.md`)
- Vitest for tests (`tests/`)
- Cloudflare Workers runtime (Web Crypto only) / Node ≥ 20 (Web Crypto + built-ins only)

## Repository layout

```text
content/                 Source of truth for documents (never import from src/)
scripts/                 Build-time Node scripts (content pipeline, password hash)
shared/auth-core/        Runtime-agnostic authentication core (TS, Web Crypto only)
worker/                  Cloudflare advanced-mode worker (bundled to dist/_worker.js)
server/                  Self-hosted Node adapter (TS, compiled to dist-server/)
dev-server/              Vite dev/preview auth middleware (uses the same core)
src/                     React SPA
  features/
    document-rendering/  Renderer abstraction + react-markdown engine
    content/             Manifest types, navigation helpers, content context
    search/              Client-side search
    navigation/          Sidebar / nav tree
    document-view/       Document page, TOC
    auth/                Auth context + screens
  components/ui/         Design-system primitives (shadcn-style)
tests/                   Vitest suites
docs/                    Product documentation
```

## Hard architectural constraints (do not violate)

1. **Renderer replaceability.** Only `src/features/document-rendering/engines/react-markdown/**` may import `react-markdown`, remark/rehype plugins, shiki, or mermaid. The rest of the app imports exclusively from `src/features/document-rendering/index.ts`.
2. **Auth logic has exactly one home.** All password/session/cookie/config logic lives in `shared/auth-core/`. Adapters (`worker/`, `server/`, `dev-server/`) only do request/response plumbing. Never reimplement auth in an adapter.
3. **Content is never public.** Everything under `/content/` (markdown sources, HTML docs, images, manifest, search index) must pass the auth gate in every adapter. On Cloudflare this is only achievable because dist/_worker.js intercepts ALL requests — do not switch back to `functions/` directory routing; static assets bypass it.
4. **Fail closed.** Missing/malformed secrets must never unlock content or show a login form. `AUTH_ENABLED` missing/invalid means *enabled*.
5. **HTML documents render as real documents** in an iframe with `sandbox="allow-scripts"` only. Never parse them as Markdown; never grant `allow-same-origin`.
6. **Raw HTML in Markdown is disabled** (react-markdown default) and sanitized through the allowlist schema in `plugins.ts`. Do not loosen the sanitizer without updating `docs/MARKDOWN-RENDERING.md` and the security tests.
7. **No secrets in the client.** `PASSWORD_HASH` / `SESSION_SECRET` exist only in adapter runtime environments (`env` in Workers, `.env` in self-hosted, `.dev.vars` in local dev). Never read them in `src/`, never bundle them, never log them.

## Coding conventions

- All code comments, identifiers, commit messages and docs are in **English**.
- TypeScript strict mode; no `any` in new code (tests may use it for manifest fixtures).
- Shared/runtime code uses ESM with explicit `.js` extensions in relative imports (required by `NodeNext`).
- Frontend code uses bundler-style extensionless imports and the `@/` alias for `src/`.
- Prefer small, single-purpose modules. No state management libraries — React context is enough here.
- Tailwind utility classes in JSX; shared visual styles live in `src/index.css` (design tokens, `.md-content` prose styles).
- Components in `src/components/ui/` follow the shadcn/ui pattern (cva variants + Radix where needed).

## Security requirements (summary — details in SECURITY.md and docs/AUTHENTICATION.md)

- PBKDF2-SHA-256 (format `pbkdf2-sha256$<iterations>$<saltB64url>$<dkB64url>`); iteration count is embedded in the hash.
- HMAC-SHA256 signed session cookies: `HttpOnly`, `Secure` (auto-detected from transport), `SameSite=Lax`, `Path=/`, 7-day TTL (`SESSION_TTL_HOURS`).
- Constant-time comparisons for signatures and derived keys.
- Rate limiting on login (in-memory, documented limitation on Workers; Cloudflare WAF recommended for hard guarantees).
- Path resolution always resolves inside the content root; traversal and encoded variants are rejected (tested).
- External links get `rel="noopener noreferrer"`; the app shell ships a strict CSP; content responses get `nosniff`.

## Testing requirements

- `npm test` must pass before any commit that changes runtime behavior.
- New auth behavior ⇒ extend `tests/auth-core.test.ts` (and adapter tests in `tests/adapters.test.ts`).
- New content-pipeline behavior ⇒ extend `tests/content-pipeline.test.ts`.
- New markdown feature ⇒ extend `tests/markdown.test.ts` (mock shiki/mermaid there).
- `npm run typecheck` must pass (app, worker, server projects).
- Test runtime behavior on BOTH adapters when touching auth or content serving; adapters must behave identically.

## Deployment rules

- Cloudflare Pages: framework Vite, build `npm run build`, output `dist`, production branch `main`. Secrets are encrypted Cloudflare Secrets (`PASSWORD_HASH`, `SESSION_SECRET`); plain vars (`AUTH_ENABLED`, `SESSION_TTL_HOURS`) go in dashboard or `wrangler.toml [vars]`.
- Self-hosted: `npm run start` (or Docker: `docker compose up -d --build`). Configuration via `.env` (see `.env.example`).
- Never commit `.env`, `.dev.vars`, hashes, or session secrets.
- Update `PROGRESS.md` and `CHANGELOG.md` with meaningful changes.

## Workflow for future agents

1. Read this file, `ARCHITECTURE.md` and `docs/AUTHENTICATION.md`.
2. Check `PROGRESS.md` for current status and known issues.
3. Make the smallest change consistent with the constraints above.
4. Run `npm run typecheck` and `npm test` (ask the user to run npm commands if you cannot).
5. Update documentation that your change invalidates — docs must never contradict code.
6. Keep `PROGRESS.md` accurate; do not mark untested work as complete.

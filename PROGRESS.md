# PROGRESS.md

Status of the Ry-Mark implementation. Updated whenever a meaningful task completes.

**Status at last update: complete and verified.** Typecheck clean (app/worker/server), 90/90 tests passing (6 suites), production build succeeds, both deployment adapters verified end-to-end in a real browser / real server.

## Completed

### Phase 1 — Inspection & research
- [x] Inspected environment; inventoried available skills: no UI/shadcn/Tailwind skills are installed in this environment (registry contains office/document, browser-testing, and ZCode-config skills only). Design decisions made directly against the specification; `browser-use` testing skill earmarked for final UI verification.
- [x] Technical research: confirmed (a) Cloudflare Pages static assets take precedence over Functions → advanced-mode `_worker.js` is mandatory for content protection; (b) react-markdown v10 + remark-gfm 4.x are current and React-19 compatible; (c) Workers Web Crypto offers PBKDF2 but not Argon2 → KDF decision documented.
- [x] Repository initialized (git, `main`), `.gitignore` covering builds, synced content, and secret files.

### Phase 2 — Foundation
- [x] `package.json` (npm scripts incl. `hash:password`), Vite + Tailwind v4 + TS strict configs (app/worker/server/node projects).
- [x] Design system: CSS-variable tokens (light+dark), Tailwind v4 mapping, hand-authored `.md-content` prose stylesheet.
- [x] Content pipeline `scripts/build-content.mjs`: recursive scan, path-safety guards, frontmatter titles, manifest + search-index generation, clean sync to `public/content/`. Exported for tests.
- [x] Password tooling `npm run hash:password`: masked raw-mode prompt (Windows/Linux/macOS), CSPRNG salt, canonical format shared with the verifier via `scripts/lib/password-hash.mjs` + equivalence tests.

### Phase 5 — Authentication (implemented before adapters)
- [x] `shared/auth-core/`: PBKDF2-SHA-256 verify (constant-time), HMAC session tokens, cookie builders, `AUTH_ENABLED` fail-closed config evaluation, in-memory sliding-window rate limiter, and the complete shared `AuthService` (status/login/logout/session + content auth gate).

### Adapters
- [x] Cloudflare adapter: `worker/entry.ts` advanced-mode worker (bundled by `scripts/build-worker.mjs` to `dist/_worker.js`), all-request interception, ASSETS routing, strict CSP/security headers, fail-closed gating.
- [x] Self-hosted adapter: dependency-free Node server (`server/`), same auth core, static serving with traversal-proof path resolution, SPA fallback, security headers, `/healthz`, graceful shutdown.
- [x] Dev middleware (`dev-server/dev-auth.ts`): `vite dev`/`preview` emulate the auth endpoints using the shared core + `.dev.vars` (documented dev password `rymark-dev`).
- [x] Docker: multi-stage non-root Dockerfile, docker-compose.yml, `.env.example`, `.dev.vars.example`, wrangler.toml.

### Phase 3 — Document rendering
- [x] Renderer abstraction: stable `MarkdownRenderProps` interface, registry + lazy adapter + error boundary; engine code split out of the initial bundle.
- [x] react-markdown engine: remark/rehype pipeline with **sanitize-before-katex** ordering, allowlist schema, directive→hast→component mapping, github-slugger-identical heading slugs (shared with TOC extraction).
- [x] Components: Callouts (5 variants + custom titles), CodeBlock (Shiki dual-theme lazy + copy), Mermaid (lazy, strict security level), Tabs, Cards, Badge, FileTree; safe links/images (relative → protected `/content/`, external → noopener, `.md` links → SPA routes).
- [x] HTML rendering: independent iframe path (`sandbox="allow-scripts"`, real URL, no engine involvement).
- [x] Content loading: auth API client, manifest/search fetchers, contexts, navigation helpers.

### Phase 4 — UI
- [x] App shell: responsive layout (drawer < lg), header (breadcrumbs, search, theme, logout), generated sidebar tree with icons/selection, keyboard shortcuts (Ctrl/Cmd+K search).
- [x] Search palette: multi-term AND scoring, title weighting, excerpts + highlighting, full keyboard navigation.
- [x] Document page: breadcrumb + title, skeleton/error/empty states, prev/next navigation, IntersectionObserver TOC (hidden below xl / <3 headings).
- [x] Auth screens: login, fail-closed setup screen (exact remediation steps), malformed-hash and missing-session-secret screens.

### Phase 6 — Tests (written; run pending user `npm install`)
- [x] `tests/auth-core.test.ts` — config states, hash round-trips/tampering, session lifecycle/rotation/concurrency, cookies, rate limiting, full shared-service flows.
- [x] `tests/content-pipeline.test.ts` — path safety, discovery (nested/unicode/spaces/empty/hidden), titles, sync + stale cleanup, text extraction.
- [x] `tests/markdown.test.ts` — jsdom rendering: GFM, math, directives (callouts/tabs/cards/filetree/badge), sanitization, safe links, code/mermaid handling (shiki/mermaid mocked).
- [x] `tests/headings.test.ts`, `tests/search.test.ts`.
- [x] `tests/adapters.test.ts` — worker routing (gate/shell/healthz/404/redirect), Node static path safety, identical `AUTH_ENABLED` parsing.

### Phase 7 — Documentation
- [x] AGENTS.md, README.md, ARCHITECTURE.md, PROJECT-SPECIFICATION.md, SECURITY.md and docs/{AUTHENTICATION,PASSWORD-SETUP,DEPLOYMENT,SELF-HOSTING,MARKDOWN-RENDERING,CONTENT-STRUCTURE,UI-DESIGN}.md.
- [x] Sample content tree exercising every feature (directives, math, mermaid, HTML docs, unicode/spaces filenames, asset).

## In progress / next
- Nothing blocking. See "Future enhancements" in the verification section below.

## Known issues
- None open. (All issues found during verification were fixed — see the verification section.)

## Key technical decisions
See `ARCHITECTURE.md` §D1–D8. Summary: advanced-mode worker for CF protection; shared auth core across adapters; PBKDF2-SHA-256 with embedded work factor; stateless HMAC sessions; replaceable renderer behind registry; build-time manifest/search; sandboxed-iframe HTML; dual deployment adapters over one artifact.

## Testing & verification status (executed)

- `npm run typecheck` — clean across tsconfig.app / worker / server.
- `npm test` — **90/90 passing** across 6 suites (auth core, content pipeline, markdown rendering incl. inline badges, headings, search, deployment adapters).
- `npm run build` — frontend (~105 kB gzip initial shell), content manifest/search index, and `dist/_worker.js` (9.8 kB) all build.

### Live verification (dev server + browser automation)
- Login flow (fail-closed gate → login screen → session), logout button present.
- Sidebar tree with folders/selection/auto-expand; breadcrumbs in header + article; document TOC.
- Markdown rendering verified visually: frontmatter stripped, headings, tables, task lists, Shiki-highlighted code with copy button, KaTeX inline+display, Mermaid (theme-following), all 5 callout variants, interactive tabs, cards, badges (incl. inline text directives), file trees, images served from protected `/content/`.
- Search palette: Ctrl/Cmd+K, multi-term results with highlighting, keyboard navigation, direct navigation.
- HTML document rendered as a real document in `sandbox="allow-scripts"` iframe; parent app cannot access the iframe document (opaque origin — verified via `contentDocument` being null).
- Dark and light themes both verified (Mermaid re-renders per theme after reload).
- Mobile (390px): drawer navigation with backdrop, no horizontal page overflow, tables scroll internally.

### Live verification (self-hosted Node adapter, real server on :8199)
- `/healthz` 200; unauthenticated `/content/*` → 401; unauthenticated `/` → shell 200.
- Login: wrong password 401, correct password 200 + `Set-Cookie` (HttpOnly/SameSite=Lax/Path=/).
- Authenticated: manifest, markdown source, HTML doc, SVG asset, search index, Unicode/space filenames → all 200; logout clears cookie.
- Path traversal `/content/../_worker.js` → 404; missing docs → 404 JSON; SPA deep link → 200; `/_worker.js` never served (shell fallback instead).

### Issues found and fixed during verification
1. Frontmatter leaked into rendered markdown → stripped in the engine.
2. GitHub-style `> [!TIP]` not supported (by design) → sample content uses directives.
3. Directive nesting syntax: outer containers need MORE colons than inner (verified against remark-directive behavior); docs + content corrected.
4. Container labels (bracketed `[Title]`) are represented as a flagged first paragraph in mdast → promoted to `dataLabel` in the remark plugin; leaf labels extracted from inline children.
5. `title`/`tone` attributes were stripped by the sanitizer / dropped by the JSX runtime → allowlist extended; callout title read at the hast level.
6. Inline badges need the 1-colon text directive (`:badge[...]`) — leaf directives only parse at line start; documented + tested.
7. **Self-hosted adapter**: `setHeader` after `writeHead` threw `ERR_HTTP_HEADERS_SENT` (Set-Cookie never sent) → cookie headers set before `writeHead`.
8. **Self-hosted adapter**: `/content/...` prefix was not stripped before content-root resolution (all authed content 404) → fixed + re-verified.

## In progress / next
- Nothing blocking. Optional future work listed below.

## Future enhancements (non-blocking)
- Mermaid does not re-render on theme toggle without a reload (acceptable; renders correctly per theme on load).
- Optional Cloudflare WAF rate-limiting rule for `POST /api/auth/login` (dashboard click, documented).
- Playwright end-to-end suite (browser-level flows currently verified manually via automation).

## Deployment readiness
- Ready. Cloudflare Pages: build `npm run build`, output `dist` (advanced-mode worker verified in build output). Self-hosted: `npm run start` / Docker verified live (auth gate, cookies, content serving, traversal rejection). Secrets setup documented in `docs/PASSWORD-SETUP.md`. Production deployment itself is a manual/administrative step outside this repo.

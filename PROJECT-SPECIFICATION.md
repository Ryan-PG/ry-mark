# PROJECT-SPECIFICATION.md

Living record of Ry-Mark's product requirements and expected behavior, synchronized with the implementation. The original brief lives in `TASK.md`; this file is the maintained, consolidated version.

## Product definition

A **read-only, password-protected viewer** for Markdown and HTML documentation, deployable to **Cloudflare Pages** or **self-hosted Node.js/Docker**. No editor, no upload, no CMS, no database, no conventional business API. Cloudflare Pages Functions-style runtime is used *only* for authentication and protected content delivery.

## Functional requirements

### Content & navigation
- F1: `content/` is the source of truth; unlimited nesting.
- F2: Navigation generated automatically at build time (manifest); no per-document configuration.
- F3: Markdown files and HTML files are navigation items; assets are not (but are servable/protected).
- F4: Adding/removing/renaming files updates nav + search on the next build.
- F5: Search index generated at build time; client-side search over titles + content with keyboard navigation, highlighting, direct navigation to results.

### Rendering
- F6: `.md` files → rendered by a **replaceable** Markdown engine (initial: react-markdown + remark-gfm/math/directive; rehype katex/slug/autolink/sanitize; Shiki; Mermaid).
- F7: Rich components: Note/Info/Warning/Danger/Success callouts, CodeBlock with copy, Tabs, Cards, Badge, FileTree — documented directives with examples.
- F8: Raw HTML inside Markdown disabled by default; sanitization allowlist if/where HTML is ever supported.
- F9: `.html` files displayed as **real documents** in a sandboxed iframe (`allow-scripts` only), preserving structure, CSS, JS, images, relative paths, external stylesheets, metadata. Never parsed as Markdown.
- F10: TOC from headings; heading anchors; breadcrumbs; document title.

### Authentication
- F11: One shared password for multiple simultaneous users; no accounts.
- F12: Secrets: `PASSWORD_HASH`, `SESSION_SECRET` (encrypted Cloudflare Secrets / self-hosted env). Never exposed client-side or committed.
- F13: Secure password hashing: unique salt, documented/configurable work factor, versioned format, constant-time comparison. Selected: PBKDF2-SHA-256, 100k iterations default, rationale documented (Workers-compatible).
- F14: `npm run hash:password` — masked cross-platform prompt, secure salt, exact runtime format, prints only the hash, never persists the password.
- F15: Signed sessions (HMAC, Web Crypto), HttpOnly+Secure+SameSite+Path=/ cookie, TTL (7d default), per-browser independence, logout per-browser, `SESSION_SECRET` rotation invalidates all.
- F16: Endpoints: `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`; brute-force rate limiting (documented limitation + WAF recommendation).
- F17: Fail closed: missing `PASSWORD_HASH` → setup screen (no login form, no content); malformed hash → configuration error screen; missing `SESSION_SECRET` → configuration error screen. `AUTH_ENABLED` missing/invalid ⇒ enabled.
- F18: All content protected (`.md`, `.html`, images, assets, manifest, search index); direct URLs denied without session; preview deployments fail closed too.
- F19: Changing `PASSWORD_HASH` changes the password without code changes; session behavior documented.

### Multi-deployment
- F20: `AUTH_ENABLED=true|false` (missing/invalid ⇒ true) honored identically on both targets.
- F21: Shared auth core (password, session, cookie, expiry, authorization, config validation); separate Cloudflare and self-hosted adapters; no auth logic duplication.
- F22: Self-hosted: Dockerfile, docker-compose.yml, `.env.example`, persistent config instructions, `/healthz`, production startup, Nginx/Caddy reverse-proxy docs, HTTPS/secure-cookie requirements, no database.
- F23: Deployment consistency: same frontend build, manifest, renderer, auth core, access rules on both targets; equivalent-behavior tests.

### UI/UX
- F24: Professional documentation layout: sidebar (brand, search trigger, hierarchical nav, collapsible folders, selected state, icons, responsive), content pane (title, breadcrumbs, proper width, excellent typography, responsive tables, loading/error states), optional TOC rail, header (identity, breadcrumbs, theme toggle, search) without clutter.
- F25: Design system: color/typography/spacing/radius/shadow tokens, component variants, polished light AND dark themes, subtle transitions, no generic dashboard look.
- F26: Responsive desktop/laptop/tablet/mobile; sidebar → drawer on mobile; no horizontal page overflow (wide code/tables scroll internally).
- F27: Accessibility: keyboard navigation, visible focus, ARIA, semantics, contrast, screen-reader-friendly nav.

### Quality
- F28: TypeScript strict; clear separation; small modules; error boundaries; centralized configuration.
- F29: Tests: content pipeline (nesting, discovery, unicode, spaces, empty dirs, invalid paths, missing docs), markdown features + sanitization, HTML rendering behavior, auth (all fail-closed/ session/ rate-limit scenarios), deployment adapters (build, compatibility, secret availability, no leakage).
- F30: Performance: lazy engine/Shiki/Mermaid chunks, no rendering of whole collections, build-time search index, small initial bundle.

## Expected behaviors (acceptance summary)

| Scenario | Expected |
| --- | --- |
| Fresh deployment without secrets | Setup screen; `curl /content/*` → 401/302; no login form |
| Wrong password | 401 “Invalid password.”; rate limit after 5 failures/10 min |
| Correct password (two browsers) | Both sessions independent; logout in one doesn't affect the other |
| Rotate `SESSION_SECRET` | All sessions invalid |
| Deep link to `/doc/...` unauthenticated | Redirects to shell → login |
| Open `.html` doc | Real HTML, assets load, JS runs, no access to app cookies |
| Markdown with script tag | Script never executes or renders |
| Unicode/space filenames | Discoverable, navigable, searchable |
| Empty content dir | Empty-state message |
| `AUTH_ENABLED=false` | All content public, secrets unrequired |

## Out of scope

Editing, uploads, multi-user accounts, comments, databases, server-side rendering of documents, analytics.

# Changelog

All notable changes to Ry-Mark.

## Unreleased

### Added
- Brand assets: new logo mark (an "R" whose leg ends in a down-right arrow — "read on") in `docs/brand/` (`logo-mark.svg`, `logo-wordmark.svg`, `logo-wordmark-dark.svg`), used as the new `public/favicon.svg` and in the README header.

### Changed
- In-app `BrandMark` (sidebar, header, loading state, login screen) redrawn to match the new logo, still inline SVG with design tokens (CSP-safe).

## 1.0.0 — Initial release

### Added
- React 19 + Vite + TypeScript (strict) + Tailwind CSS v4 frontend with a full design system (light/dark themes).
- Documentation layout: generated sidebar, breadcrumbs, header, contextual TOC, prev/next navigation, loading/error/empty states, responsive drawer on mobile.
- Replaceable Markdown rendering abstraction (`features/document-rendering`) with the react-markdown engine: remark-gfm, remark-math + KaTeX, remark-directive components (callouts, tabs, cards, file trees, badges), rehype-sanitize allowlist, Shiki syntax highlighting with copy button, lazy-loaded Mermaid.
- Real-HTML document rendering in a sandboxed iframe (independent of Markdown rendering).
- Build-time content pipeline: manifest + search index generation, clean content sync, path-safety enforcement.
- Client-side search palette with keyboard navigation and match highlighting.
- Shared authentication core (`shared/auth-core`): PBKDF2-SHA-256 password verification (versioned hash format, constant-time), HMAC-signed stateless session cookies, fail-closed configuration evaluation, per-IP login rate limiting.
- Cloudflare Pages adapter (advanced-mode `dist/_worker.js`) protecting all content including manifest and search index; strict CSP/security headers.
- Self-hosted Node.js adapter (dependency-free server) with identical auth/access behavior, `/healthz`, SPA fallback, and traversal-proof static serving.
- Dev/preview auth middleware so local development exercises the real login flow.
- `npm run hash:password` cross-platform masked password-hash generator.
- Docker deployment: multi-stage non-root Dockerfile, docker-compose, `.env.example`, health check.
- Authentication gate UX: login screen, fail-closed setup screen with remediation steps, configuration error screens; `AUTH_ENABLED` toggle (missing ⇒ enabled).
- Test suites: auth core, content pipeline, markdown rendering (jsdom), headings, search, deployment adapters.
- Full documentation set (AGENTS, ARCHITECTURE, SECURITY, deployment/auth/password/rendering/content/UI guides, PROJECT-SPECIFICATION, PROGRESS).
- Sample content collection demonstrating every supported feature.

# Ry-Mark

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)](./package.json)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](./docs/DEPLOYMENT.md)
[![Docker](https://img.shields.io/badge/self--host-Docker-2496ED?logo=docker&logoColor=white)](./docs/SELF-HOSTING.md)

A polished, password-protected **Markdown & HTML documentation viewer**. It reads documents from a `content/` directory, generates navigation and search automatically, and deploys either to **Cloudflare Pages** or **self-hosted via Node.js / Docker** — with identical behavior.

Read-only by design: no editor, no database, no upload system.

## Highlights

- **Beautiful reading experience** — modern documentation layout, light/dark themes, syntax highlighting (Shiki), math (KaTeX), diagrams (Mermaid), callouts, tabs, cards, file trees, task lists, tables.
- **Real HTML documents** — `.html` files render in a sandboxed iframe with styles, scripts and relative assets intact.
- **Replaceable Markdown engine** — react-markdown is an implementation detail behind a stable renderer abstraction.
- **Shared password auth** — PBKDF2-hashed password, HMAC-signed HttpOnly session cookies, zero backend state.
- **Automatic navigation & search** — a build-time manifest and search index are generated from `content/`; add a file, and it appears.
- **Two deployment targets, one codebase** — Cloudflare Pages Functions runtime or a dependency-free Node server, sharing one auth core.

## Quick start (local development)

Prerequisites: Node.js ≥ 20.

```bash
npm install
npm run dev
```

The dev server boots with a built-in development password (`rymark-dev`) so you can try the login flow immediately. To use your own credentials locally, copy `.dev.vars.example` to `.dev.vars`, run `npm run hash:password`, and paste the hash into `PASSWORD_HASH`.

Content lives in [`content/`](./content). The first document (root `README.md` here) opens at `/`.

## Production build

```bash
npm run build      # frontend + content manifest + Cloudflare worker
npm run typecheck  # app, worker, server
npm test           # unit + rendering tests
```

## Deploy to Cloudflare Pages

1. Push the repository to GitHub and create a Cloudflare Pages project from it.
2. Build settings: framework **Vite**, build command `npm run build`, output directory `dist`, production branch `main`.
3. Set two encrypted Secrets (Settings → Variables and Secrets → type *Secret*):
   - `PASSWORD_HASH` — output of `npm run hash:password`
   - `SESSION_SECRET` — a long random value (≥ 32 chars). Generate it on any platform:

     ```bash
     node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
     ```
4. Optional plain variables: `AUTH_ENABLED` (`false` disables auth), `SESSION_TTL_HOURS`.
5. Deploy. Direct content URLs, images, the manifest and the search index are all protected — see `docs/AUTHENTICATION.md`.

Full guide: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Self-host with Docker

```bash
npm run hash:password   # copy the printed hash
cp .env.example .env    # fill in PASSWORD_HASH + SESSION_SECRET
docker compose up -d --build
```

The app listens on port 8080 with a health check at `/healthz`. Reverse-proxy recipes for Nginx and Caddy are in [docs/SELF-HOSTING.md](./docs/SELF-HOSTING.md).

## Adding content

Create Markdown or HTML files anywhere under `content/` (nesting is unlimited):

```text
content/
├── README.md
├── Engineering/
│   ├── Architecture.md
│   └── Backend/
│       ├── API.md
│       └── Schema.html
└── Resources/
    └── images/
        └── architecture.svg
```

Navigation, breadcrumbs, search and the table of contents update automatically on the next build — no configuration files to edit. See [docs/CONTENT-STRUCTURE.md](./docs/CONTENT-STRUCTURE.md) for supported Markdown extensions (`:::note`, tabs, cards, file trees, badges).

## Documentation

| Document | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and key decisions |
| [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md) | Auth design, sessions, threat model |
| [docs/PASSWORD-SETUP.md](./docs/PASSWORD-SETUP.md) | Generating and installing the password hash |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Cloudflare Pages deployment |
| [docs/SELF-HOSTING.md](./docs/SELF-HOSTING.md) | Node/Docker deployment, reverse proxies |
| [docs/MARKDOWN-RENDERING.md](./docs/MARKDOWN-RENDERING.md) | Renderer abstraction + directive reference |
| [docs/CONTENT-STRUCTURE.md](./docs/CONTENT-STRUCTURE.md) | Content directory rules and manifest |
| [docs/UI-DESIGN.md](./docs/UI-DESIGN.md) | Design system |
| [SECURITY.md](./SECURITY.md) | Security model and hardening notes |
| [PROJECT-SPECIFICATION.md](./PROJECT-SPECIFICATION.md) | Product requirements |
| [PROGRESS.md](./PROGRESS.md) | Implementation status |
| [AGENTS.md](./AGENTS.md) | Rules for AI agents working on this repo |

## License

This project is licensed under the [MIT License](./LICENSE).

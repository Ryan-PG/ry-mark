---
title: Docker Quickstart
---

# Docker Quickstart

Run Ry-Mark self-hosted in under a minute — no database required.

## 1. Generate your secrets

```bash
npm run hash:password
```

Copy the printed hash, then create a `.env` file next to `docker-compose.yml`:

```ini
AUTH_ENABLED=true
PASSWORD_HASH=pbkdf2-sha256$100000$…your-hash…
SESSION_SECRET=<openssl rand -base64 48>
```

## 2. Start the container

```bash
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080), enter the password, done.

## 3. Health check

```bash
curl -fsS http://localhost:8080/healthz
```

:::success
The image runs as a non-root user, has a built-in `HEALTHCHECK`, and carries no `node_modules` at runtime — the server uses only Node.js built-ins.
:::

## Updating content

Content lives in `content/` and is baked into the image at build time. Rebuild to update:

```bash
docker compose up -d --build
```

:::warning
Never bake secrets into the image. Always pass `PASSWORD_HASH` and `SESSION_SECRET` through the environment (`.env` or your orchestrator's secret mechanism).
:::

## Reverse proxies

- **Nginx**: proxy to port 8080 and forward `X-Forwarded-Proto: https` so cookies get the `Secure` flag. See `docs/SELF-HOSTING.md`.
- **Caddy**: automatic HTTPS — one line: `docs.example.com { reverse_proxy localhost:8080 }`.

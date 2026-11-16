# Self-Hosting (Node.js / Docker)

Ry-Mark runs without Cloudflare using a dependency-free Node server (`server/`) that enforces the exact same authentication and content rules as the Cloudflare worker.

## Requirements

- Node.js ≥ 20, or any Docker runtime
- ~60 MB RAM; no database

## Option A — Docker Compose (recommended)

```bash
npm run hash:password      # copy the printed hash
cp .env.example .env       # fill PASSWORD_HASH + SESSION_SECRET
docker compose up -d --build
```

Generate `SESSION_SECRET` on any platform (≥ 32 characters):

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

- App: `http://localhost:8080`
- Health check: `GET /healthz` (built into the image's HEALTHCHECK)
- The image is multi-stage (build → runtime), runs as a non-root user, and carries no `node_modules`.

Update content or code: `docker compose up -d --build`.

To serve external content without rebuilding, mount it over the built content dir:

```yaml
volumes:
  - ./my-docs:/app/dist/content:ro
```

(The manifest and search index inside the image won't reflect externally mounted files; rebuild normally instead if you use search/navigation.)

## Option B — Bare Node

```bash
npm ci
npm run build          # frontend + content + worker bundle
npm run start          # compiles the server (tsc) and starts it
```

`npm run start` reads `.env` from the project root (see `.env.example`) and listens on `PORT` (default 8080) at `HOST` (default 0.0.0.0).

### systemd

```ini
[Unit]
Description=Ry-Mark documentation viewer
After=network-online.target

[Service]
User=rymark
WorkingDirectory=/opt/ry-mark
EnvironmentFile=/opt/ry-mark/.env
ExecStart=/usr/bin/node dist-server/server/main.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `AUTH_ENABLED` | `true` | `false` disables authentication |
| `PASSWORD_HASH` | — | Required when auth on (`npm run hash:password`) |
| `SESSION_SECRET` | — | Required when auth on (≥ 32 random chars) |
| `SESSION_TTL_HOURS` | `168` | Session lifetime |
| `PORT` | `8080` | Listening port |
| `HOST` | `0.0.0.0` | Bind address |
| `DIST_DIR` | `./dist` | Frontend build directory |

## HTTPS and secure cookies — required in production

Session cookies get the `Secure` flag automatically when the request is HTTPS or arrives through a proxy that sends `X-Forwarded-Proto: https`. **Deploy behind TLS**: termination at the proxy is fine.

- **Caddy** (automatic HTTPS):

  ```caddyfile
  docs.example.com {
      reverse_proxy 127.0.0.1:8080
  }
  ```

- **Nginx**:

  ```nginx
  server {
      listen 443 ssl;
      server_name docs.example.com;
      ssl_certificate     /etc/letsencrypt/live/docs.example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/docs.example.com/privkey.pem;

      location / {
          proxy_pass         http://127.0.0.1:8080;
          proxy_set_header   Host $host;
          proxy_set_header   X-Forwarded-Proto https;   # ← required for Secure cookies
          proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_read_timeout 60s;
      }
  }
  ```

Do not expose port 8080 directly to the internet; keep it on loopback or an internal network and let the proxy handle TLS, HSTS and access logs.

## What the server protects

Exactly the same contract as the Cloudflare adapter (shared auth core):

- `/api/auth/*` — auth endpoints (rate limited: 5 failures / 10 min / IP)
- `/content/*` — all documents, assets, manifest and search index (auth gate)
- `/healthz` — public plain-text `ok`
- Everything else — SPA shell from `dist/` with strict security headers and SPA fallback

## Verifying the deployment

```bash
curl -fsS http://127.0.0.1:8080/healthz                  # → ok
curl -i  http://127.0.0.1:8080/content/manifest.json     # → 401 without cookie
curl -i  http://127.0.0.1:8080/                          # → 200, app shell
```

Startup logs report the auth configuration state (never secret values). If the server says `state: unconfigured`, set `PASSWORD_HASH` and restart.

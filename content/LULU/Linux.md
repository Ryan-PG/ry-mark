---
title: Linux Notes
---

# Linux Notes

Assorted commands that tend to be useful when operating Ry-Mark on a small VPS.

## systemd unit

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

## Firewall

```bash
# Only expose the reverse proxy; keep the app on loopback.
ufw allow 443/tcp
ufw deny 8080/tcp
```

## Verifying the deployment

```bash
# Public: health check must answer without a session.
curl -i http://127.0.0.1:8080/healthz

# Protected: must redirect to the login screen without a cookie.
curl -i http://127.0.0.1:8080/content/manifest.json
```

:::info
If the second request returns JSON content instead of `401`/`302`, authentication is disabled (`AUTH_ENABLED=false`) or secrets are missing — check the startup log lines emitted by the server.
:::

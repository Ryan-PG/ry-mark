---
title: API Conventions
---

# API Conventions

Ry-Mark exposes **infrastructure endpoints only** — there is no business API and no content mutation.

## Authentication endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/auth/status` | Configuration state + login state |
| POST | `/api/auth/login` | Password → signed session cookie |
| POST | `/api/auth/logout` | Clears the session cookie |
| GET | `/api/auth/session` | Session validity + expiration |
| GET | `/healthz` | Public health check (self-hosted) |

## Content endpoints

All content is served from the protected `/content/` prefix:

- `/content/<path>.md` — raw Markdown source
- `/content/<path>.html` — real HTML documents
- `/content/manifest.json` — generated navigation manifest
- `/content/search-index.json` — generated search corpus

:::danger
Never request content by a path supplied by the browser without validation. All adapters resolve paths inside the content root and reject traversal (`../`), encoded variants and absolute paths.
:::

## Response shapes

Errors are uniform JSON:

```json
{ "error": "Invalid password." }
```

Rate-limited logins answer `429 Too Many Requests` with a `Retry-After` header.

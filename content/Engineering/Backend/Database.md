---
title: Database Notes
---

# Database Notes (or: why there isn't one)

Ry-Mark is intentionally stateless. Everything the server needs is either:

1. **Static** — content files and the generated manifest/index, or
2. **Secret-backed** — `PASSWORD_HASH` and `SESSION_SECRET` in the runtime environment.

## Sessions without storage

Sessions are HMAC-signed tokens carried in an `HttpOnly` cookie. There is no session table:

- Each browser holds an independent random session id (`sid`).
- Logout simply clears that browser's cookie.
- Rotating `SESSION_SECRET` invalidates every issued session at once.

## Consequences

:::info
Because nothing is stored, backups, migrations and GDPR deletion requests do not apply. The only mutable state is configuration in your deployment platform.
:::

Changing `PASSWORD_HASH` changes the shared password immediately for new logins; existing sessions remain valid until they expire (7 days by default) — see [Authentication docs](../../../docs/AUTHENTICATION.md).

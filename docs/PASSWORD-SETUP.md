# Password Setup

How to generate the password hash and install it on each deployment target.

## 1. Generate the hash

```bash
npm run hash:password
```

- You will be prompted twice for the password (masked input; works on Windows, Linux, macOS).
- The command prints **only the resulting hash**, e.g.:

```text
pbkdf2-sha256$100000$Xk9…$Bq3…
```

- The plaintext password is never displayed, saved, or logged. Nothing is written to the repository.

> Work factor: the default is 100,000 PBKDF2-SHA-256 iterations. See [AUTHENTICATION.md](./AUTHENTICATION.md#runtime-cost-on-cloudflare) for plan-specific guidance. The iteration count travels inside the hash — no extra configuration is needed.

## 2a. Install on Cloudflare Pages (encrypted Secret)

1. Open your project in the Cloudflare dashboard.
2. **Settings → Variables and Secrets**.
3. Add a **Secret** (type “Secret”, not “Text”) named `PASSWORD_HASH` — paste the generated hash.
4. Add another **Secret** named `SESSION_SECRET` — a long random value (≥ 32 characters). Generate it on any platform:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
   ```

   (or `openssl rand -base64 48` on Linux/macOS).
5. Optional plain **variables**: `AUTH_ENABLED` (default `true`), `SESSION_TTL_HOURS` (default `168`).
6. Redeploy if the dashboard asks, then refresh the app.

CLI alternative:

```bash
npx wrangler pages secret put PASSWORD_HASH
npx wrangler pages secret put SESSION_SECRET
```

## 2b. Install self-hosted (.env)

```bash
cp .env.example .env
npm run hash:password            # paste the hash into PASSWORD_HASH
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"   # paste into SESSION_SECRET
```

The `.env` file is git-ignored. In Docker Compose the container reads `.env` via `env_file`. For bare Node: `npm run start` reads the same `.env` from the project root.

## 3. Verify

1. Open the app in a fresh browser profile → the login screen appears.
2. Try a wrong password → “Invalid password.”, no content access.
3. Try direct content access without login, e.g. `curl -i https://your-host/content/manifest.json` → `401`.
4. Sign in → content loads; a second browser can log in independently with the same password.

## Changing the password

1. Run `npm run hash:password` again.
2. Replace the `PASSWORD_HASH` secret (same place as above).
3. Redeploy if required.

- New logins use the new password immediately.
- Existing sessions remain valid until their TTL expires (7 days by default). To force everyone out, also rotate `SESSION_SECRET` (all sessions become invalid instantly).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Setup screen (“Password protection is not configured”) | `PASSWORD_HASH` secret missing → run the generator, set the secret, redeploy |
| “PASSWORD_HASH is malformed” | Value changed/truncated in transit (extra quotes, spaces) → regenerate and replace |
| “SESSION_SECRET is not configured / too short” | Set `SESSION_SECRET` to ≥ 32 random characters |
| “Too many attempts” | 5 failed logins per 10 min per IP — wait, or clear by logging in successfully from another IP |
| Login works locally but not on the deployment | Secrets are per-environment: set them for **production** and **preview** separately |
| Cookie not sent over plain HTTP | `Secure` cookies require HTTPS; self-hosted testing behind a proxy must forward `X-Forwarded-Proto: https` |

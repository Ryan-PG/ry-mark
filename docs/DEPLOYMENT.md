# Deployment — Cloudflare Pages

## Prerequisites

- The repository on GitHub (or GitLab).
- A Cloudflare account (Pages is available on all plans).

## First deployment

1. **Create the project**: Cloudflare dashboard → Workers & Pages → Create → Pages → *Connect to Git* → select the repository.

2. **Build configuration**:

   | Setting | Value |
   | --- | --- |
   | Framework preset | `Vite` (or None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Production branch | `main` |

3. **Set the secrets** before the first login attempt (Settings → Variables and Secrets):
   - `PASSWORD_HASH` (type: Secret) — output of `npm run hash:password`
   - `SESSION_SECRET` (type: Secret) — long random value, ≥ 32 chars. Generate on any platform:
     `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"`
   - Optional plain variables: `AUTH_ENABLED` (`true`/`false`), `SESSION_TTL_HOURS`

4. **Deploy.** Every push to `main` deploys production; pushes to other branches create preview deployments.

## How content protection works here (important)

Ry-Mark uses Cloudflare Pages **advanced mode**: the build emits `dist/_worker.js`, which intercepts *every* request. This is what makes content protection possible — in standard Pages routing, static assets are served before any Function could run, so `functions/`-directory routes can never protect files that exist in the build output (this behavior is documented by Cloudflare; see references below).

Consequently:

- Do not add a `functions/` directory — it is ignored in advanced mode.
- Do not remove `scripts/build-worker.mjs` from the build.
- Direct URLs to `/content/*` are gated by the worker; unauthenticated requests get `401` (API/asset) or `302` (browser navigation → shell).

## Preview deployments

Previews get the same worker and fail closed the same way. Secrets configured for the **production environment** are not automatically available to previews unless you assign them to all environments (dashboard: Variables and Secrets → select environments). If a preview shows the setup screen, that is the fail-closed behavior doing its job — set the secrets for the preview environment too, or accept locked previews.

## Ongoing updates

- Normal code/content pushes **do not require resetting secrets** — secrets persist across builds.
- Rotating `SESSION_SECRET` invalidates all sessions (see [AUTHENTICATION.md](./AUTHENTICATION.md)).
- Changing the password = regenerate `PASSWORD_HASH` (see [PASSWORD-SETUP.md](./PASSWORD-SETUP.md)).

## Local verification with Wrangler

```bash
npm run build
npx wrangler pages dev dist
```

Copy `.dev.vars.example` to `.dev.vars` and fill `PASSWORD_HASH` (from `npm run hash:password`) and `SESSION_SECRET` to exercise real login flows locally. Wrangler runs the same `_worker.js` that production uses.

## Checklist

- [ ] Build succeeds (`npm run build` locally first)
- [ ] `PASSWORD_HASH` + `SESSION_SECRET` set as **Secrets** (not plain text)
- [ ] Unauthenticated `curl -i https://<project>.pages.dev/content/manifest.json` → `401`
- [ ] Unauthenticated `curl -i https://<project>.pages.dev/` → shell HTML (login flow in app)
- [ ] Login works; logout works; second browser session independent
- [ ] Dark/light mode, mobile layout, search spot-checked
- [ ] No `.dev.vars`/`.env` committed

## References

- Cloudflare Pages Functions routing (static assets vs Functions): <https://developers.cloudflare.com/pages/functions/routing/>
- Pages advanced mode (`_worker.js`): <https://developers.cloudflare.com/pages/functions/advanced-mode/>
- Pages Secrets / environment variables: <https://developers.cloudflare.com/pages/configuration/variables-and-secrets/>
- Workers Web Crypto (`crypto.subtle`): <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>
- Workers CPU limits: <https://developers.cloudflare.com/workers/platform/limits/#cpu-time>

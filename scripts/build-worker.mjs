/**
 * Builds the Cloudflare Pages advanced-mode worker.
 *
 * Bundles worker/entry.ts (which imports shared/auth-core) into a single
 * self-contained dist/_worker.js. Cloudflare Pages detects _worker.js in the
 * build output root and routes ALL requests through it (see worker/entry.ts
 * for why this is required to protect static content).
 *
 * esbuild is used for bundling because Vite itself cannot emit to two
 * different roots, and wrangler bundles only when running `wrangler dev`.
 */
import { build } from "esbuild";

const result = await build({
  entryPoints: ["worker/entry.ts"],
  outfile: "dist/_worker.js",
  bundle: true,
  format: "esm",
  target: "es2023",
  platform: "browser", // Workers runtime: standard fetch APIs, no Node builtins
  minify: true,
  sourcemap: false,
  legalComments: "none",
  metafile: false,
  logLevel: "info",
});

if (result.errors.length > 0) {
  console.error("Worker bundle failed.");
  process.exit(1);
}

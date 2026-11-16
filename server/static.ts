/**
 * Static file serving for the self-hosted adapter (with strict path-safety).
 *
 * Serves the built frontend from dist/ and the (auth-gated) content tree from
 * dist/content/. The Cloudflare worker bundle (dist/_worker.js) is a build
 * artifact of a different deployment target and is deliberately NOT served.
 */
import fs from "node:fs";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
};

/** Content-type by extension (kept conservative: unknown → octet-stream). */
export function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Resolves a URL pathname to an absolute file path inside `rootDir` or null.
 * Decoding + normalization + prefix check makes traversal impossible: paths
 * such as /content/../secrets or %-encoded variants cannot escape the root.
 */
export function resolveSafePath(rootDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  // Strip the leading slash(es) before normalizing: URLs always start with
  // "/", but the resolved file must be treated as root-relative.
  const relative = decoded.replace(/^\/+/, "");
  // Reject any traversal ATTEMPT outright — even if normalization would
  // collapse it back inside the root (defense in depth).
  if (relative.split(/[\\/]/).includes("..")) return null;
  const normalized = path.posix.normalize(relative);
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) return null;

  const absolute = path.resolve(rootDir, normalized);
  const resolvedRoot = path.resolve(rootDir);
  const rootWithSeparator = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (!absolute.startsWith(rootWithSeparator)) return null;
  return absolute;
}

export interface ServeResult {
  readonly status: number;
  readonly body: Buffer;
  readonly contentType: string;
  readonly cacheControl: string;
}

/** Reads a file to serve. Returns null when it does not exist. */
export function serveFile(absolutePath: string, cacheControl = "no-cache"): ServeResult | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  try {
    return {
      status: 200,
      body: fs.readFileSync(absolutePath),
      contentType: contentTypeFor(absolutePath),
      cacheControl,
    };
  } catch {
    return null;
  }
}

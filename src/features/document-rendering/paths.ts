/** Path helpers for the document-rendering feature (pure functions). */

/** Public content URL for a document/asset path relative to the content root. */
export function contentUrlFor(path: string): string {
  return `/content/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** SPA route for a document path, e.g. "Engineering/API.md" → /doc/Engineering/API.md */
export function docRouteFor(path: string): string {
  return `/doc/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Resolves a relative href/src against the current document path (relative
 * to the content root). Absolute, protocol and hash targets pass through.
 */
export function resolveRelativePath(target: string, documentPath?: string): string {
  if (!target || /^(https?:|mailto:|data:|#|\/)/i.test(target) || !documentPath) return target;
  const segments = documentPath.includes("/")
    ? documentPath.slice(0, documentPath.lastIndexOf("/")).split("/").filter(Boolean)
    : [];
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

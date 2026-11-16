/**
 * Navigation helpers over the content manifest tree.
 * Pure functions — no filesystem or engine coupling.
 */
import type { ManifestDirNode, ManifestDocNode, ManifestNode } from "../../lib/api";

/** All documents in display order (directories first, depth-first). */
export function flattenDocuments(node: ManifestNode): ManifestDocNode[] {
  if (node.type === "md" || node.type === "html") return [node];
  if (node.type === "dir") {
    return node.children.flatMap(flattenDocuments);
  }
  return [];
}

/** Finds a document node by its content-relative path (e.g. "Engineering/API.md"). */
export function findDocument(node: ManifestNode, path: string): ManifestDocNode | null {
  const normalized = decodeURIComponent(path).replace(/^\//, "");
  if (node.type === "dir") {
    for (const child of node.children) {
      const match = findDocument(child, normalized);
      if (match) return match;
    }
    return null;
  }
  if ((node.type === "md" || node.type === "html") && node.path === normalized) {
    return node;
  }
  return null;
}

/** Breadcrumb segments (directories + document) for a path. */
export interface BreadcrumbSegment {
  title: string;
  path: string;
}

export function breadcrumbsFor(path: string): BreadcrumbSegment[] {
  const segments = decodeURIComponent(path).split("/").filter(Boolean);
  const crumbs: BreadcrumbSegment[] = [];
  let accumulated = "";
  for (let i = 0; i < segments.length; i++) {
    accumulated = accumulated ? `${accumulated}/${segments[i]}` : segments[i]!;
    crumbs.push({
      title: i === segments.length - 1 ? humanizeName(segments[i]!) : segments[i]!,
      path: accumulated,
    });
  }
  return crumbs;
}

/** Humanizes a file/dir name: strips extensions, dashes → spaces. */
export function humanizeName(name: string): string {
  return name
    .replace(/\.(md|html)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The default document shown at "/" (root README/index, else first doc). */
export function defaultDocumentPath(root: ManifestDirNode): string | null {
  const docs = flattenDocuments(root);
  if (docs.length === 0) return null;
  const preferred = docs.find((doc) => /^(readme|index)\.md$/i.test(doc.name));
  return (preferred ?? docs[0]!).path;
}

/** Previous / next documents for footer navigation. */
export function neighborsOf(root: ManifestDirNode, path: string): { prev: ManifestDocNode | null; next: ManifestDocNode | null } {
  const docs = flattenDocuments(root);
  const index = docs.findIndex((doc) => doc.path === path);
  return {
    prev: index > 0 ? (docs[index - 1] ?? null) : null,
    next: index >= 0 && index < docs.length - 1 ? (docs[index + 1] ?? null) : null,
  };
}

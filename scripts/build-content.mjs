/**
 * Content pipeline: scans the content/ source tree, copies it into
 * public/content/ (which Vite emits into dist/content/), and generates:
 *
 *   public/content/manifest.json       — navigation + metadata for the SPA
 *   public/content/search-index.json   — client-side search corpus
 *
 * The generated files live under /content/, which every deployment adapter
 * protects with the auth gate (see worker/entry.ts and server/). Nothing is
 * exposed to the SPA bundle itself, so no content metadata can leak through
 * the public application shell.
 *
 * Security notes:
 * - Only relative POSIX paths inside content/ are ever emitted; the generator
 *   rejects path traversal (`..`) and absolute/hidden entries.
 * - Hidden files/directories (leading dot) and node_modules are ignored.
 * - Browsers never touch the filesystem; they consume the generated manifest.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CONTENT_ROOT = path.resolve(process.env.RYMARK_CONTENT_ROOT ?? "content");
const PUBLIC_CONTENT = path.resolve(process.env.RYMARK_PUBLIC_CONTENT ?? path.join("public", "content"));

/** Entry types stored in the manifest. */
const TYPE_MD = "md";
const TYPE_HTML = "html";
const TYPE_ASSET = "asset";
const TYPE_DIR = "dir";

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const MAX_SEARCH_TEXT_CHARS = 20_000;

/** Guard against traversal and unsafe segments; returns a normalized relative path or null. */
function safeRelativePath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) return null;
  const normalized = relativePath.split(/[\\/]+/).join("/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) return null;
  if (normalized.split("/").some((seg) => seg.startsWith(".") || seg.trim() === "")) return null;
  return normalized;
}

/** Human-readable title from a filename (or frontmatter title override). */
function titleFromFilename(filename) {
  const stem = filename.replace(/\.(md|html)$/i, "");
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase()) || stem;
}

/** Extracts a `title:` from a leading `---` YAML frontmatter block (title only). */
function extractFrontmatterTitle(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(source);
  if (!match) return null;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^\s*title\s*:\s*(.+?)\s*$/.exec(line);
    if (kv && kv[1]) {
      return kv[1].replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

function classifyFile(filename) {
  if (/\.md$/i.test(filename)) return TYPE_MD;
  if (/\.html?$/i.test(filename)) return TYPE_HTML;
  return TYPE_ASSET;
}

/** Extracts plain text from markdown for the search index. */
function markdownToSearchText(source) {
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\s*/m, "") // frontmatter
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading markers
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, "") // list bullets / tasks
    .replace(/\|/g, " ") // table pipes
    .replace(/[*_~]{1,3}/g, "") // emphasis markers
    .replace(/\${1,2}[^$]*\${1,2}/g, " ") // math
    .replace(/<[^>]+>/g, " ") // raw html tags
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_TEXT_CHARS);
}

/** Extracts plain text from HTML for the search index. */
function htmlToSearchText(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_TEXT_CHARS);
}

async function walk(dirAbsolutePath, dirRelativePath) {
  const entries = await fs.readdir(dirAbsolutePath, { withFileTypes: true });
  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const relative = dirRelativePath ? `${dirRelativePath}/${entry.name}` : entry.name;
    if (safeRelativePath(relative) === null) {
      console.warn(`[ry-mark] Skipping unsafe path: ${relative}`);
      continue;
    }
    if (entry.isDirectory()) {
      dirs.push({ entry, relative });
    } else if (entry.isFile()) {
      files.push({ entry, relative });
    }
  }

  const sortByName = (a, b) => a.entry.name.localeCompare(b.entry.name, "en", { sensitivity: "base" });
  dirs.sort(sortByName);
  files.sort(sortByName);

  const children = [];

  for (const { entry, relative } of dirs) {
    const childNodes = await walk(path.join(dirAbsolutePath, entry.name), relative);
    // Empty directories are still represented so the structure is visible.
    children.push({
      type: TYPE_DIR,
      name: entry.name,
      title: entry.name,
      path: relative,
      id: relative,
      children: childNodes,
    });
  }

  for (const { entry, relative } of files) {
    const type = classifyFile(entry.name);
    const node = {
      type,
      name: entry.name,
      path: relative,
      id: relative,
    };
    if (type === TYPE_MD) {
      const source = await fs.readFile(path.join(dirAbsolutePath, entry.name), "utf8");
      const frontTitle = extractFrontmatterTitle(source);
      node.title = frontTitle || titleFromFilename(entry.name);
      node.searchText = markdownToSearchText(source);
    } else if (type === TYPE_HTML) {
      const source = await fs.readFile(path.join(dirAbsolutePath, entry.name), "utf8");
      node.title = titleFromFilename(entry.name);
      node.searchText = htmlToSearchText(source);
    } else {
      node.title = entry.name;
    }
    children.push(node);
  }

  return children;
}

/** Recursively copies src → dest skipping hidden entries and node_modules. */
async function copyFiltered(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyFiltered(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

async function syncToPublic() {
  // Ensure a clean target: stale files must never survive a rename/delete.
  await fs.rm(PUBLIC_CONTENT, { recursive: true, force: true });
  await fs.mkdir(PUBLIC_CONTENT, { recursive: true });
  await copyFiltered(CONTENT_ROOT, PUBLIC_CONTENT);
}

/** Entry-point guard: exporting everything so tests can import the pipeline. */
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error("[ry-mark] Content build failed:", error);
    process.exit(1);
  });
}

export {
  safeRelativePath,
  titleFromFilename,
  extractFrontmatterTitle,
  classifyFile,
  markdownToSearchText,
  htmlToSearchText,
  walk,
  syncToPublic,
  copyFiltered,
  main as buildContent,
  CONTENT_ROOT,
  PUBLIC_CONTENT,
  TYPE_MD,
  TYPE_HTML,
  TYPE_ASSET,
  TYPE_DIR,
};

async function main() {
  let rootChildren = [];
  try {
    rootChildren = await walk(CONTENT_ROOT, "");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      console.warn("[ry-mark] No content/ directory found; generating empty manifest.");
    } else {
      throw error;
    }
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    root: {
      type: TYPE_DIR,
      name: "",
      title: "Home",
      path: "",
      id: "",
      children: rootChildren,
    },
  };

  const searchIndex = [];
  const collect = (node) => {
    for (const child of node.children) {
      if (child.type === TYPE_DIR) {
        collect(child);
      } else if ((child.type === TYPE_MD || child.type === TYPE_HTML) && child.searchText) {
        searchIndex.push({
          id: child.id,
          title: child.title,
          path: child.path,
          type: child.type,
          text: child.searchText,
        });
      }
    }
  };
  collect(manifest.root);
  // searchText is not part of the manifest payload.
  const stripSearchText = (node) => {
    if (Array.isArray(node?.children)) {
      node.children = node.children.map(stripSearchText);
    }
    const copy = { ...node };
    delete copy.searchText;
    return copy;
  };
  const cleanManifest = { ...manifest, root: stripSearchText(manifest.root) };

  await syncToPublic();
  await fs.writeFile(
    path.join(PUBLIC_CONTENT, "manifest.json"),
    JSON.stringify(cleanManifest, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(PUBLIC_CONTENT, "search-index.json"),
    JSON.stringify(searchIndex),
    "utf8",
  );

  const count = (node) =>
    (node.children ?? []).reduce((acc, c) => acc + (c.type === TYPE_DIR ? count(c) : 1), 0);
  console.log(
    `[ry-mark] Manifest generated: ${count(manifest.root)} entries, ` +
      `${searchIndex.length} searchable documents.`,
  );
  return manifest;
}


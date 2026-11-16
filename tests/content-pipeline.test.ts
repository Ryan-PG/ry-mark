/**
 * Content pipeline tests: manifest generation, discovery, path safety,
 * search text extraction. Uses a temporary content root via env overrides
 * (RYMARK_CONTENT_ROOT / RYMARK_PUBLIC_CONTENT are resolved at import time,
 * so tests set them and re-import the module dynamically).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpRoot: string;
let tmpPublic: string;
let pipeline: typeof import("../scripts/build-content.mjs");

async function write(relative: string, contents: string): Promise<void> {
  const absolute = path.join(tmpRoot, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, contents, "utf8");
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rymark-content-"));
  tmpPublic = await fs.mkdtemp(path.join(os.tmpdir(), "rymark-public-"));
  process.env.RYMARK_CONTENT_ROOT = tmpRoot;
  process.env.RYMARK_PUBLIC_CONTENT = tmpPublic;
  pipeline = await import("../scripts/build-content.mjs");
});

describe("path safety", () => {
  it("rejects traversal and unsafe relative paths", () => {
    expect(pipeline.safeRelativePath("../secrets.txt")).toBeNull();
    expect(pipeline.safeRelativePath("a/../../b")).toBeNull();
    expect(pipeline.safeRelativePath("/etc/passwd")).toBeNull();
    expect(pipeline.safeRelativePath(".hidden")).toBeNull();
    expect(pipeline.safeRelativePath("dir/.hidden")).toBeNull();
    expect(pipeline.safeRelativePath("")).toBeNull();
  });

  it("normalizes backslashes and accepts safe paths", () => {
    expect(pipeline.safeRelativePath("a\\b\\c.md")).toBe("a/b/c.md");
    expect(pipeline.safeRelativePath("Engineering/API.md")).toBe("Engineering/API.md");
  });
});

describe("manifest generation", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manifest: any;

  beforeAll(async () => {
    await write("README.md", "# Welcome\n\nRoot document.");
    await write("Engineering/Architecture.md", "# Architecture");
    await write("Engineering/Backend/API.md", "---\ntitle: API Reference\n---\n# API");
    await write("Engineering/Backend/Schema.html", "<h1>Schema</h1>");
    await write("Tutorials/Docker.md", "# Docker");
    await write("Tutorials/Linux.md", "# Linux");
    await write("Tutorials/Advanced/Networking.html", "<h1>Networking</h1>");
    await write("Style Guide.md", "# Style guide");
    await write("Unicode/文档 español.md", "# Hola");
    await write("Resources/images/diagram.svg", "<svg/>");
    // Empty directory must still be represented.
    await fs.mkdir(path.join(tmpRoot, "EmptyDir"), { recursive: true });
    // Hidden files must be ignored.
    await write(".hidden/secret.txt", "nope");
    await write("Engineering/.DS_Store", "nope");

    manifest = await pipeline.buildContent();
  });

  it("represents every directory including empty ones", () => {
    const names = manifest.root.children.map((c: { name: string }) => c.name);
    expect(names).toContain("Engineering");
    expect(names).toContain("Tutorials");
    expect(names).toContain("Resources");
    expect(names).toContain("EmptyDir");
    expect(names).not.toContain(".hidden");
  });

  it("discovers markdown and html files as documents", () => {
    const docs: { path: string; type: string }[] = [];
    const collect = (node: any) => {
      for (const child of node.children) {
        if (child.type === "dir") collect(child);
        else if (child.type === "md" || child.type === "html") docs.push({ path: child.path, type: child.type });
      }
    };
    collect(manifest.root);
    const paths = docs.map((d) => d.path);
    expect(paths).toContain("README.md");
    expect(paths).toContain("Engineering/Backend/API.md");
    expect(paths).toContain("Engineering/Backend/Schema.html");
    expect(paths).toContain("Tutorials/Advanced/Networking.html");
    expect(paths).toContain("Style Guide.md");
    expect(paths).toContain("Unicode/文档 español.md");
    expect(docs.every((d) => d.type === "md" || d.type === "html")).toBe(true);
  });

  it("does not turn assets into documents", () => {
    const find = (node: any, name: string): any | undefined => {
      for (const child of node.children) {
        if (child.name === name) return child;
        if (child.type === "dir") {
          const found = find(child, name);
          if (found) return found;
        }
      }
      return undefined;
    };
    const asset = find(manifest.root, "diagram.svg");
    expect(asset.type).toBe("asset");
  });

  it("uses frontmatter titles when present, humanizes otherwise", () => {
    const find = (node: any, name: string): any | undefined => {
      for (const child of node.children) {
        if (child.name === name) return child;
        if (child.type === "dir") {
          const found = find(child, name);
          if (found) return found;
        }
      }
      return undefined;
    };
    expect(find(manifest.root, "API.md").title).toBe("API Reference");
    expect(find(manifest.root, "Style Guide.md").title).toBe("Style Guide");
    expect(find(manifest.root, "文档 español.md").title).toBe("文档 Español");
  });

  it("syncs content and generated files into the public directory", async () => {
    const manifestFile = await fs.readFile(path.join(tmpPublic, "manifest.json"), "utf8");
    expect(JSON.parse(manifestFile).version).toBe(1);
    const searchFile = await fs.readFile(path.join(tmpPublic, "search-index.json"), "utf8");
    const search = JSON.parse(searchFile) as { id: string }[];
    expect(search.some((entry) => entry.id === "Tutorials/Docker.md")).toBe(true);
    const synced = await fs.readFile(path.join(tmpPublic, "Engineering", "Architecture.md"), "utf8");
    expect(synced).toContain("# Architecture");
    // Hidden files are never synced.
    expect(await fs.readdir(tmpPublic)).not.toContain(".hidden");
  });

  it("removes stale files from previous syncs", async () => {
    await write("Transient.md", "# Gone soon");
    await pipeline.buildContent();
    expect(await fs.readdir(tmpPublic)).toContain("Transient.md");
    await fs.rm(path.join(tmpRoot, "Transient.md"));
    await pipeline.buildContent();
    expect(await fs.readdir(tmpPublic)).not.toContain("Transient.md");
  });
});

describe("search text extraction", () => {
  it("strips markdown syntax from text", () => {
    const text = pipeline.markdownToSearchText(
      "---\ntitle: X\n---\n# Heading\n\n**bold** and `code` and [link](https://x) text\n\n```js\nignored()\n```\n\n- item\n- [ ] task",
    );
    expect(text).toContain("bold");
    expect(text).toContain("link");
    expect(text).toContain("item");
    expect(text).not.toContain("ignored()");
    expect(text).not.toContain("**");
    expect(text).not.toContain("[link]");
  });

  it("strips tags and scripts from html", () => {
    const text = pipeline.htmlToSearchText("<h1>Title</h1><script>alert(1)</script><p>Body</p>");
    expect(text).toContain("Title");
    expect(text).toContain("Body");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("<");
  });
});

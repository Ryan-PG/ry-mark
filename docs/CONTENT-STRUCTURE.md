# Content Structure

`content/` is the single source of truth. Everything else (navigation, search, breadcrumbs, TOC) is generated from it at build time — no configuration files per document.

## Layout

```text
content/
├── README.md                  ← opens at "/" (any of README.md / index.md)
├── Engineering/
│   ├── Architecture.md
│   ├── Diagrams.html          ← real HTML document
│   └── Backend/
│       ├── API.md
│       ├── Database.md
│       └── Schema.html
├── Tutorials/
│   ├── Docker.md
│   ├── Linux.md
│   └── Advanced/
│       └── Networking.html
└── Resources/
    ├── Style Guide.md         ← spaces are fine
    ├── Notes español.md       ← Unicode is fine
    └── images/
        └── architecture.svg   ← asset, not a nav item
```

## Rules

1. **Any nesting depth is supported.** Every directory appears in the sidebar (including empty ones).
2. **`.md` and `.html`/`.htm` files become navigation items.** Documents are sorted alphabetically within their directory, directories first.
3. **Assets (images, PDFs, anything else) never become navigation items** — they are served under the protected `/content/` prefix and can be referenced from documents by relative path.
4. Hidden files/directories (leading `.`) and `node_modules` are ignored.
5. Filenames with spaces and Unicode are fully supported (per-segment URL encoding).
6. Adding/removing/renaming a file updates navigation and search on the next build — automatically.

## Titles

A document's display title comes from, in order:

1. Frontmatter: the first `---` block with `title:` on it
2. Otherwise, the filename: extension stripped, dashes/underscores → spaces, capitalized

```markdown
---
title: API Reference
---
```

## What the build generates

`npm run build` (and `npm run dev`, via pre-hooks) runs `scripts/build-content.mjs`, which:

- syncs `content/` into `public/content/` (clean copy — renames/deletions never leave stale files),
- emits `public/content/manifest.json` — hierarchy, file names, types, relative paths, stable ids, titles,
- emits `public/content/search-index.json` — per-document plain text extracted from Markdown/HTML (syntax stripped, capped at 20k chars per document).

Both generated files live under `/content/`, which every deployment adapter protects with the auth gate. The SPA bundle contains no content data.

## Path safety

The generator and every serving adapter enforce:

- only relative POSIX paths inside the content root are ever emitted or served;
- traversal (`..`), absolute paths, encoded variants, NUL bytes and hidden entries are rejected (covered by tests);
- browsers never touch a filesystem — they consume the manifest and URLs.

## Referencing other documents and assets

```markdown
[Sibling doc](./Backend/API.md)
[From root](../README.md)
![Diagram](./images/architecture.svg)
```

Relative targets resolve against the current document's directory. Anchors (`#section`) work normally.

## HTML documents

`.html` files are **real documents**: served from their original URL inside a sandboxed iframe. Keep them self-contained (inline `<style>`/`<script>` is fine; relative assets next to the file work too). They are searchable (tags/scripts stripped from the index text) but rendered exactly as authored.

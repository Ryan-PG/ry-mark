# Markdown Rendering

How Ry-Mark renders Markdown, the replaceable engine boundary, and the full directive reference.

## Engine abstraction (replaceable)

The application never imports `react-markdown` outside `src/features/document-rendering/engines/react-markdown/`.

```text
src/features/document-rendering/
├── core/
│   ├── types.ts             MarkdownRenderProps — the stable contract
│   ├── renderer-registry.ts registerRenderer() / getActiveRenderer()
│   └── renderer-adapter.tsx lazy-loads + error-bounds the engine
├── components/
│   ├── DocumentViewer.tsx   kind switch: markdown → engine, html → iframe
│   ├── HtmlDocument.tsx     isolated iframe (independent of Markdown)
│   └── ErrorState.tsx
├── engines/react-markdown/  the current engine implementation
│   ├── index.tsx            default export component
│   ├── plugins.ts           remark/rehype pipeline + sanitizer schema
│   ├── components.tsx       element → React component map
│   └── ui/                  Callout, CodeBlock, Tabs, Cards, Badge, FileTree, Mermaid
├── bootstrap.ts             registration entry point
└── index.ts                 public API of the feature
```

To swap engines later: implement a component accepting `MarkdownRenderProps`, register it in `bootstrap.ts` with a new id, set it as the active renderer in `renderer-registry.ts`. Nothing else changes — the sidebar, loader, viewer, search, and layout are engine-agnostic.

## Pipeline

```text
remark-gfm → remark-math → remark-directive → directive→hast mapper
→ rehype-sanitize (allowlist) → rehype-katex → rehype-slug
→ rehype-autolink-headings → directive→component mapper
```

Order matters:

- **Sanitize before KaTeX** — KaTeX-generated markup is never stripped; the allowlist never needs KaTeX internals.
- **Slug/autolink after sanitize** — heading ids and anchors survive.
- Raw HTML in Markdown is **disabled** (react-markdown skips raw HTML nodes) and additionally stripped by the sanitizer. Do not enable `rehype-raw`.

## Supported Markdown

Headings (with hover anchors), paragraphs, bold/italic/strikethrough, ordered/unordered/nested lists, task lists, tables, blockquotes, links, images, inline code, fenced code with **Shiki** highlighting + copy button, KaTeX math (`$inline$`, `$$block$$`), **Mermaid diagrams** (lazy-loaded), horizontal rules, heading anchors, and automatic table of contents (from `##`/`###`, shown when ≥ 3 headings).

## Directives (custom components)

Directives use the `remark-directive` syntax. Two rules matter:

- **Nesting:** the OUTER container needs MORE colons than the inner one. A bare fence closes every open container with an equal-or-lower colon count.
- **Titles/labels:** the bracketed `[label]` of a callout/tab/card becomes its title; for `::file`/`::dir` it is the displayed name. Callouts also accept `:::note{title="Custom"}`.

### Callouts

````markdown
:::note
Neutral supplementary information.
:::

:::info{title="Good to know"}
Blue callout with a custom title.
:::

:::success / :::warning / :::danger — same shape.
````

### Tabs

````markdown
:::::tabs
::::tab[npm]
npm install
::::
::::tab[pnpm]
pnpm install
::::
:::::
````

### Cards

````markdown
:::::cards
::::card[Markdown engine]
Swap engines without touching the app.
::::
:::::
````

### Badges

```markdown
::badge[Stable]{tone=success}     tones: default primary info success warning danger
```

### File trees

````markdown
:::::filetree
::::dir[content]
::file[README.md]
:::dir[Backend]
::file[API.md]
:::
::::
:::::
````

### Code block controls

Languages map to Shiki grammars; unknown languages fall back to plain rendering. The language label and copy button are always shown.

## Safe links and images

- `https?://` links open in a new tab with `rel="noopener noreferrer"`.
- Relative `*.md`/`*.html` links resolve against the current document's directory and navigate within the SPA (`/doc/...`).
- Relative image paths resolve into the protected `/content/` tree (authentication applies).
- HTML documents embed relative assets by virtue of the iframe loading the real URL.

## Bundle behavior

- The engine is a lazy chunk (first document view loads it).
- Shiki loads on first code block; Mermaid on first diagram; KaTeX CSS ships with the engine chunk.
- Render failures are contained by an error boundary inside the content pane.

# UI Design

Ry-Mark's interface goals: calm, typographically excellent, intentionally designed — inspired by the clarity of VitePress/Mintlify/Stripe Docs without copying any of them.

## Layout

```text
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ Header: breadcrumbs · search · theme · logout│
│ 288px    ├──────────────────────────────────────────────┤
│          │  Document title                              │
│ brand    │  Breadcrumbs                                 │
│ search   │  ── content ──────────────────  │  TOC   │   │
│ nav tree │  (max-width prose column)      │  (xl+) │   │
│          │  prev / next footer                          │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar** (`src/features/navigation/Sidebar.tsx`): brand mark, search trigger (kbd hint), generated hierarchical tree with collapsible folders, type icons (folder / markdown / globe for HTML), clear selected state, scrollable, footer with theme toggle + logout. On < lg screens it becomes an overlay drawer with a dimmed backdrop.
- **Header**: compact (3.5rem) — mobile sidebar trigger, breadcrumb trail, search icon, theme toggle, logout. Never overcrowded.
- **Content pane**: readable measure (~72ch for prose), generous vertical rhythm, document loading skeleton, error state with retry, prev/next document footer.
- **TOC** (`TableOfContents.tsx`): right rail on xl screens, scroll-spy highlighting via IntersectionObserver, hidden when fewer than 3 `##`/`###` headings or below xl.

## Design system

Tokens are CSS variables in `src/index.css`, mapped into Tailwind v4 utilities via `@theme inline` (shadcn/ui convention):

- **Surfaces**: `background` (page), `surface` (cards/inputs), `sidebar`, `muted`, `border`, `input`
- **Primary**: indigo — `primary`, `primary-foreground`, `primary-soft` (selections/callout backgrounds)
- **Semantic**: `info` / `success` / `warning` / `danger` + `-soft` pairs (callouts, badges, alerts)
- **Code**: `code-bg`, `code-border`
- Radius scale (`--radius` ± steps), soft `shadow-card`

Typography: system UI sans stack (no webfont → CSP-clean, fast, native feel) with a tuned scale (body 15–15.5px, h1 3xl/700, h2 with hairline rule); mono stack for code with 0.85rem code blocks.

**Dark mode**: class-based (`html.dark`), resolved pre-paint in `index.html` (no flash), persisted in `localStorage`, toggled in the sidebar/header. Dark palette is a true companion (zinc-navy surfaces, softened accent), not an inversion.

## Markdown prose styles (`.md-content`)

Hand-authored stylesheet (no `@tailwindcss/typography` dependency): heading spacing/scroll-margins, quiet list markers, task-list checkboxes, indigo-ruled blockquotes, bordered code chips, overflow-scrolling tables with zebra rows, KaTeX display overflow, hidden-until-hover `#` anchors, rounded images.

## Components (`src/components/ui/`)

shadcn/ui pattern — Radix primitives + `cva` variants, customized to the token palette: `Button` (default/outline/ghost/subtle × sizes), `Input`, `Dialog` (search palette). Document-level components live in the rendering engine (`Callout`, `CodeBlock`, `Tabs`, `Cards`, `Badge`, `FileTree`, `Mermaid`).

## States

- **Loading**: shimmer skeletons (sidebar + document), never blank screens
- **Empty**: clear message when `content/` has no documents
- **Error**: in-pane error card with retry (document load, render failure, manifest failure)
- **Auth gates**: login, setup-instructions, and configuration-error screens share one centered card layout

## Accessibility

- Semantic landmarks (`nav`, `aside`, `main`, `article`), `aria-current="page"` on the active doc, `role="tree"`/`treeitem` with `aria-expanded` in the nav, `role="combobox"`/`listbox`/`option` in the search palette
- Visible focus ring (`:focus-visible` on `--ring`) everywhere; keyboard operation of nav, search (↑/↓/Enter/Esc), tabs, dialogs
- Contrast: body text ≥ 7:1 in both themes; muted text ≥ 4.5:1
- Reduced motion: transitions are 120–200ms and transform/opacity only

## Responsive behavior

| Breakpoint | Layout |
| --- | --- |
| < lg | Drawer sidebar, hamburger in header, full-width prose |
| lg–xl | Fixed sidebar, no TOC |
| ≥ xl | Sidebar + content + TOC rail |

Tables and code blocks scroll horizontally within the prose column; the page itself never scrolls horizontally.

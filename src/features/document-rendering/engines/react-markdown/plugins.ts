/**
 * remark / rehype plugin pipeline for the react-markdown engine.
 *
 * Pipeline order (security-relevant — do not reorder casually):
 *
 *   remark-gfm          GitHub Flavored Markdown (tables, tasks, strikethrough)
 *   remark-math         $...$ / $$...$$ math blocks (language-math)
 *   remark-directive    ::: containers, :: leaves, :text directives
 *   remarkDirectiveHast (local) maps directives to div/span + data-label
 *   rehype-sanitize     strips anything not on the whitelist (defense in
 *                       depth; raw HTML is already disabled by react-markdown)
 *   rehype-katex        renders math AFTER sanitization, so KaTeX output is
 *                       never mangled
 *   rehype-slug         heading ids (github-slugger)
 *   rehype-autolink     hover anchor links on headings
 *   directivesToComponents (local) converts directive divs into synthetic
 *                       elements mapped to React components
 *
 * Raw HTML inside markdown is NOT rendered: react-markdown skips raw HTML
 * nodes by default, which satisfies the "disabled by default" requirement.
 */
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Element, ElementContent, Root, RootContent } from "hast";
import type { PluggableList, Plugin } from "unified";

/* --------------------------------------------------------------------------
 * Directive → hast mapping
 * ------------------------------------------------------------------------- */

type DirectiveNode = {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name?: string;
  label?: string | null;
  attributes?: Record<string, string | number | (string | number | null)[] | undefined> | undefined;
  children?: unknown[];
  data?: Record<string, unknown> | undefined;
};

/** Depth-first walk over children arrays (avoids an extra dependency). */
function walk(node: unknown, visitor: (node: DirectiveNode) => void): void {
  const current = node as { children?: unknown[]; type?: string };
  if (
    current?.type === "containerDirective" ||
    current?.type === "leafDirective" ||
    current?.type === "textDirective"
  ) {
    visitor(current as DirectiveNode);
  }
  for (const child of current?.children ?? []) walk(child, visitor);
}

function toHastProperties(node: DirectiveNode): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const attributes = node.attributes ?? {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") continue;
    // hast properties use DOM-camelCase names; React accepts them as props.
    properties[key.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return properties;
}

/**
 * remark plugin: gives every directive node hast mapping data so remark-rehype
 * emits `div`/`span` elements with the directive name as the first class and
 * the label (if any) as a data-label property.
 */
/** Extracts concatenated text from hast content nodes. */
function hastText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  let text = "";
  for (const node of nodes) {
    const current = node as { type?: string; value?: string; children?: unknown[] };
    if (current?.type === "text" && typeof current.value === "string") text += current.value;
    else if (Array.isArray(current?.children)) text += hastText(current.children);
  }
  return text;
}

export const remarkDirectiveHast: Plugin = () => (tree: unknown) => {
  walk(tree, (node) => {
    // Container directives represent their bracketed label as a first child
    // paragraph flagged with data.directiveLabel. Promote it to a dataLabel
    // property and drop it from the rendered content.
    const children = node.children as
      | Array<{ type: string; data?: { directiveLabel?: boolean }; children?: Array<{ value?: string }> }>
      | undefined;
    if (Array.isArray(children) && children.length > 0) {
      const first = children[0];
      if (first?.type === "paragraph" && first.data?.directiveLabel === true) {
        const labelText = (first.children ?? [])
          .map((c) => (typeof c.value === "string" ? c.value : ""))
          .join("")
          .trim();
        if (labelText) node.label = labelText;
        node.children = children.slice(1);
      }
    }

    // Leaf directives carry their label as inline content (text children);
    // containers may also expose node.label. Normalize into dataLabel.
    let label = typeof node.label === "string" ? node.label : "";
    if (!label && node.type !== "containerDirective") {
      label = hastText(node.children).trim();
    }
    const data = node.data as { hChildren?: unknown } | undefined;
    if (!label && data?.hChildren) label = hastText(data.hChildren).trim();

    const className = [node.name ?? "unknown"];
    const properties = toHastProperties(node);
    if (label) properties.dataLabel = label;
    node.data = {
      ...(node.data ?? {}),
      hName: node.type === "textDirective" ? "span" : "div",
      hProperties: { ...properties, className },
    };
  });
};

/* --------------------------------------------------------------------------
 * Sanitize schema (allowlist)
 * ------------------------------------------------------------------------- */

const CALLOUT_NAMES = ["note", "info", "success", "warning", "danger"];
const CONTAINER_NAMES = [...CALLOUT_NAMES, "tabs", "tab", "cards", "card", "filetree", "file", "dir"];

export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...CONTAINER_NAMES],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    // Directives and language classes travel on className; labels on dataLabel.
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "dataLabel", "id", "title", "tone"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    div: [...(defaultSchema.attributes?.div ?? []), "className", "dataLabel"],
    // KaTeX math is generated after sanitization; mathml classes may pass.
    math: [...(defaultSchema.attributes?.math ?? []), "className"],
  },
};

/* --------------------------------------------------------------------------
 * Directive div → synthetic component elements
 * ------------------------------------------------------------------------- */

function classNameOf(element: Element): string[] {
  const value = element.properties?.className;
  return Array.isArray(value) ? value.map(String) : [];
}

function labelOf(element: Element): string | undefined {
  const value = element.properties?.dataLabel;
  return typeof value === "string" ? value : undefined;
}

function firstClassName(element: Element): string {
  return classNameOf(element)[0] ?? "";
}

/**
 * rehype plugin (after sanitize): turns directive divs into synthetic
 * elements (`callout`, `tabs`, `tab`, `cards`, `card`, `filetree`, `file`,
 * `dir`) that the React component map renders.
 */
export const rehypeDirectivesToComponents: Plugin = () => (tree: unknown) => {
  const root = tree as Root;

  const transform = (content: RootContent): RootContent => {
    if (content.type !== "element") return content;
    const element = content as Element;
    const name = firstClassName(element);

    const children = element.children.map(transform);

    if (CALLOUT_NAMES.includes(name)) {
      // Bracket labels become dataLabel; `title="..."` attributes are kept by
      // the sanitizer and read here (the JSX runtime drops `title` on custom
      // elements, so it never reaches React props directly).
      const titleAttr = typeof element.properties?.title === "string" ? element.properties.title : undefined;
      return {
        ...element,
        tagName: "callout",
        properties: { variant: name, label: labelOf(element) ?? titleAttr },
        children: children as ElementContent[],
      };
    }
    if (name === "badge") {
      return {
        ...element,
        tagName: "badge",
        properties: { tone: element.properties?.tone ?? "default" },
        children: (element.children ?? []).map(transform) as ElementContent[],
      };
    }
    if (name === "tabs" || name === "cards" || name === "filetree") {
      return {
        ...element,
        tagName: name,
        properties: {},
        children: children.map((child) => {
          if (child.type !== "element") return child;
          const childName = firstClassName(child as Element);
          if (name === "filetree") {
            // "dir" entries are containers that may nest further entries.
            if (childName === "dir") {
              return {
                ...(child as Element),
                tagName: "dir",
                properties: { label: labelOf(child as Element) ?? "", kind: "dir" },
                children: (child as Element).children.map(transform),
              };
            }
            if (childName === "file") {
              return {
                ...(child as Element),
                tagName: "file",
                properties: { label: labelOf(child as Element) ?? "", kind: "file" },
              };
            }
            return child;
          }
          if (childName === name.slice(0, -1)) {
            // "tabs"→"tab", "cards"→"card"
            return {
              ...(child as Element),
              tagName: childName,
              properties: { label: labelOf(child as Element) },
              children: (child as Element).children,
            };
          }
          return child;
        }) as ElementContent[],
      };
    }
    if (name === "file" || name === "dir") {
      // Stray file/dir entries outside a filetree still render as a tree.
      return {
        ...element,
        tagName: name,
        properties: { label: labelOf(element) ?? "", kind: name },
        children: (element.children ?? []).map(transform) as ElementContent[],
      };
    }
    if (name === "card" || name === "tab") {
      return { ...element, tagName: name, properties: { label: labelOf(element) }, children: children as ElementContent[] };
    }
    return { ...element, children: children as ElementContent[] };
  };

  root.children = root.children.map(transform);
};

/* --------------------------------------------------------------------------
 * Final pipeline
 * ------------------------------------------------------------------------- */

export const remarkPlugins: PluggableList = [
  remarkGfm,
  remarkMath,
  remarkDirective,
  remarkDirectiveHast,
];

export const rehypePlugins: PluggableList = [
  // Sanitize BEFORE KaTeX so KaTeX-generated markup is never stripped.
  [rehypeSanitize, sanitizeSchema],
  rehypeKatex,
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    {
      behavior: "append",
      properties: { "aria-hidden": true, tabIndex: -1 },
      content: {
        type: "element",
        tagName: "span",
        properties: { className: ["anchor-link"] },
        children: [{ type: "text", value: "#" }],
      },
    },
  ],
  rehypeDirectivesToComponents,
];

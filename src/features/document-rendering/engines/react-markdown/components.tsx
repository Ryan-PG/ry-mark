/**
 * react-markdown component mapping: hast elements → Ry-Mark React components.
 *
 * Includes safe link/image handling (relative paths resolve into the
 * protected /content tree; external links open with rel=noopener) and the
 * synthetic directive elements produced by rehypeDirectivesToComponents.
 */
import { Children, createContext, isValidElement, useContext, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "./ui/CodeBlock";
import { Badge, FileTree, type FileTreeNode } from "./ui/Badge";
import { Callout, type CalloutVariant } from "./ui/Callout";
import { Cards, Tabs, type CardItem, type TabItem } from "./ui/Tabs";
import { contentUrlFor, docRouteFor, resolveRelativePath } from "../../paths";

/* --------------------------------------------------------------------------
 * Context: path of the document being rendered (relative to the content
 * root) so relative links/images resolve into the protected content tree.
 * ------------------------------------------------------------------------- */

export const DocumentPathContext = createContext<string | undefined>(undefined);

/* --------------------------------------------------------------------------
 * Safe links and images
 * ------------------------------------------------------------------------- */

const EXTERNAL_PROTOCOL = /^(https?:|mailto:)/i;

interface ElementProps {
  href?: string;
  src?: string;
  alt?: string;
  className?: string;
  children?: ReactNode;
}

function SafeLink(props: ElementProps) {
  const documentPath = useContext(DocumentPathContext);
  const { href, children, ...rest } = props;
  const target = href ?? "";

  if (EXTERNAL_PROTOCOL.test(target)) {
    return (
      <a href={target} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  if (/\.(md|html)$/i.test(target)) {
    const resolved = resolveRelativePath(target, documentPath);
    return (
      <Link to={docRouteFor(resolved)} {...rest}>
        {children}
      </Link>
    );
  }
  // In-document fragment or other relative target: leave untouched.
  return (
    <a href={target} {...rest}>
      {children}
    </a>
  );
}

function SafeImage(props: ElementProps) {
  const documentPath = useContext(DocumentPathContext);
  const { src, alt } = props;
  if (!src) return null;
  const resolved = EXTERNAL_PROTOCOL.test(src) ? src : contentUrlFor(resolveRelativePath(src, documentPath));
  return <img src={resolved} alt={alt ?? ""} loading="lazy" />;
}

/* --------------------------------------------------------------------------
 * Code / pre (Shiki CodeBlock for fenced blocks, plain code inline)
 * ------------------------------------------------------------------------- */

function CodeComponent({ className, children }: ElementProps) {
  const language = /language-([\w-]+)/.exec(className ?? "")?.[1];
  // Block code arrives wrapped in <pre> (unwrapped via PreComponent below);
  // inline code has no language class and stays a plain <code>.
  if (language) {
    return <CodeBlock code={String(children ?? "")} language={language} />;
  }
  return <code className={className}>{children}</code>;
}

function PreComponent({ children }: ElementProps) {
  // Unwrap <pre><code>…</code></pre> so CodeBlock's styled container is not
  // nested inside a <pre> (invalid HTML).
  return <>{children}</>;
}

/* --------------------------------------------------------------------------
 * Directive components
 * ------------------------------------------------------------------------- */

/** Props a synthetic directive element may carry. */
interface DirectiveProps {
  label?: string;
  title?: string;
  variant?: string;
  kind?: string;
  children?: ReactNode;
}

/** Narrows a React child to a directive element's props (or null). */
function directiveProps(child: ReactNode, type: unknown): DirectiveProps | null {
  if (isValidElement(child) && child.type === type) {
    return child.props as DirectiveProps;
  }
  return null;
}

function CalloutDirective({ variant, label, title, children }: DirectiveProps) {
  const safeVariant = (["note", "info", "success", "warning", "danger"] as const).includes(
    (variant ?? "note") as CalloutVariant,
  )
    ? (variant as CalloutVariant)
    : "note";
  return (
    <Callout variant={safeVariant} title={label ?? title}>
      {children}
    </Callout>
  );
}

function TabDirective(_props: DirectiveProps) {
  // Rendered nowhere directly — the parent <TabsDirective> consumes children.
  return null;
}

function TabsDirective({ children }: DirectiveProps) {
  const items: TabItem[] = [];
  Children.forEach(children, (child) => {
    const props = directiveProps(child, TabDirective);
    if (props) {
      items.push({
        id: String(props.label ?? `tab-${items.length}`),
        label: String(props.label ?? "Tab"),
        content: props.children,
      });
    }
  });
  return <Tabs items={items} />;
}

function CardDirective(_props: DirectiveProps) {
  return null;
}

function CardsDirective({ children }: DirectiveProps) {
  const items: CardItem[] = [];
  Children.forEach(children, (child) => {
    const props = directiveProps(child, CardDirective);
    if (props) {
      items.push({
        title: props.label,
        content: props.children,
      });
    }
  });
  return <Cards items={items} />;
}

function FileNodeDirective(_props: DirectiveProps) {
  return null;
}

function FileTreeDirective({ children }: DirectiveProps) {
  const toNodes = (nodes: ReactNode[]): FileTreeNode[] => {
    const result: FileTreeNode[] = [];
    Children.forEach(nodes, (node) => {
      const props = directiveProps(node, FileNodeDirective);
      if (!props) return;
      const kind = String(props.kind ?? "file");
      const label = String(props.label ?? "");
      const childNodes = props.children ? toNodes(Children.toArray(props.children)) : undefined;
      const type: FileTreeNode["type"] =
        kind === "dir" ? "dir" : /\.md$/i.test(label) ? "md" : /\.html?$/i.test(label) ? "html" : "file";
      result.push({ name: label, type, children: childNodes });
    });
    return result;
  };
  return <FileTree nodes={toNodes(Children.toArray(children))} />;
}

/* --------------------------------------------------------------------------
 * Map — react-markdown resolves element tagNames to these components.
 * Inline code (no language class) is NOT mapped: the default <code> element
 * is styled by the .md-content stylesheet.
 * ------------------------------------------------------------------------- */

export const componentMap = {
  a: SafeLink,
  img: SafeImage,
  code: CodeComponent,
  pre: PreComponent,
  callout: CalloutDirective,
  tabs: TabsDirective,
  tab: TabDirective,
  cards: CardsDirective,
  card: CardDirective,
  filetree: FileTreeDirective,
  file: FileNodeDirective,
  dir: FileNodeDirective,
  badge: Badge,
} as const;

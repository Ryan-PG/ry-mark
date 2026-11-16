/**
 * Recursive navigation tree for the sidebar, generated from the content
 * manifest. Directories are expandable; documents link to their SPA route.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  Globe,
} from "lucide-react";
import type { ManifestDirNode, ManifestDocNode, ManifestNode } from "../../lib/api";
import { docRouteFor } from "../../features/document-rendering/paths";
import { humanizeName } from "../../features/content/navigation";
import { cn } from "../../lib/utils";

export interface NavTreeProps {
  nodes: readonly ManifestNode[];
  depth?: number;
  /** Path of the currently open document (for selection + auto-expand). */
  activePath: string | null;
}

export function NavTree({ nodes, depth = 0, activePath }: NavTreeProps) {
  return (
    <ul role="tree" aria-label="Documentation navigation" className="space-y-0.5">
      {nodes.map((node) => (
        <NavItem key={node.id} node={node} depth={depth} activePath={activePath} />
      ))}
    </ul>
  );
}

function containsPath(node: ManifestNode, path: string): boolean {
  if (node.type === "dir") {
    return path === node.path || path.startsWith(`${node.path}/`);
  }
  return node.path === path;
}

function NavItem({
  node,
  depth,
  activePath,
}: {
  node: ManifestNode;
  depth: number;
  activePath: string | null;
}) {
  if (node.type === "dir") {
    return <DirItem node={node} depth={depth} activePath={activePath} />;
  }
  if (node.type === "md" || node.type === "html") {
    return <DocItem node={node} depth={depth} activePath={activePath} />;
  }
  return null; // assets never become navigation items
}

function DirItem({ node, depth, activePath }: { node: ManifestDirNode; depth: number; activePath: string | null }) {
  const shouldBeOpen = activePath !== null && containsPath(node, activePath);
  const [open, setOpen] = useState(shouldBeOpen);

  useEffect(() => {
    if (shouldBeOpen) setOpen(true);
  }, [shouldBeOpen]);

  return (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground/90 transition-colors hover:bg-muted",
          open && "text-foreground",
        )}
        style={{ paddingLeft: `${depth * 0.9 + 0.5}rem` }}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        {open ? (
          <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <FolderClosed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="truncate">{node.title || humanizeName(node.name)}</span>
      </button>
      {open ? (
        <NavTree nodes={node.children} depth={depth + 1} activePath={activePath} />
      ) : null}
    </li>
  );
}

function DocItem({ node, depth, activePath }: { node: ManifestDocNode; depth: number; activePath: string | null }) {
  const selected = activePath === node.path;
  const Icon = node.type === "html" ? Globe : FileText;

  return (
    <li role="none">
      <Link
        to={docRouteFor(node.path)}
        role="treeitem"
        aria-selected={selected}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          selected
            ? "bg-primary-soft font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 0.9 + 1.25}rem` }}
      >
        <Icon
          className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")}
          aria-hidden="true"
        />
        <span className="truncate">{node.title}</span>
      </Link>
    </li>
  );
}

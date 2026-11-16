/**
 * Badge (inline ::badge directive) and FileTree (:::filetree container with
 * ::file / ::dir leaf directives).
 */
import { FileCode2, FileText, Folder, Globe } from "lucide-react";
import type { ReactNode } from "react";

/* ---------------------------------- Badge -------------------------------- */

export type BadgeTone = "default" | "primary" | "info" | "success" | "warning" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  default: "bg-muted text-foreground border-border",
  primary: "bg-primary-soft text-primary border-primary/30",
  info: "bg-info-soft text-info border-info/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
};

export function Badge({ tone = "default", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
      data-badge={tone}
    >
      {children}
    </span>
  );
}

/* -------------------------------- FileTree ------------------------------- */

export interface FileTreeNode {
  name: string;
  type: "dir" | "md" | "html" | "file";
  children?: FileTreeNode[];
}

function NodeIcon({ type }: { type: FileTreeNode["type"] }) {
  if (type === "dir") return <Folder className="size-4 text-primary" aria-hidden="true" />;
  if (type === "md") return <FileText className="size-4 text-muted-foreground" aria-hidden="true" />;
  if (type === "html") return <Globe className="size-4 text-info" aria-hidden="true" />;
  return <FileCode2 className="size-4 text-muted-foreground" aria-hidden="true" />;
}

function FileTreeRow({ node, depth }: { node: FileTreeNode; depth: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 py-0.5 font-mono text-[13px]"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        <NodeIcon type={node.type} />
        <span>{node.name}</span>
      </div>
      {node.children?.map((child, index) => (
        <FileTreeRow key={index} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function FileTree({ nodes }: { nodes: FileTreeNode[] }) {
  return (
    <div
      className="filetree my-5 rounded-lg border bg-code-bg px-3 py-2.5"
      data-filetree=""
      role="tree"
      aria-label="File tree"
    >
      {nodes.map((node, index) => (
        <FileTreeRow key={index} node={node} depth={0} />
      ))}
    </div>
  );
}

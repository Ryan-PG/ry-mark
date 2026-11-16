/**
 * Document-rendering core types.
 *
 * This is the ONLY surface the rest of the application may use for document
 * rendering. The concrete Markdown engine (react-markdown today) is loaded
 * through the renderer registry, so swapping engines later means adding an
 * engine implementation and changing one registration line — not touching
 * the sidebar, loader, layout, or viewer.
 */
import type { ComponentType } from "react";

/** The two document types Ry-Mark renders (values match manifest node types). */
export type DocumentKind = "md" | "html";

/** Raw document payload loaded from the content API. */
export interface DocumentPayload {
  /** Stable manifest id (relative path, e.g. "Engineering/Architecture.md"). */
  readonly id: string;
  /** Content-relative path including extension. */
  readonly path: string;
  readonly title: string;
  readonly kind: DocumentKind;
}

/** Props every Markdown renderer component must accept. */
export interface MarkdownRenderProps {
  /** Raw markdown source. */
  source: string;
  /** Optional class applied to the rendered content root. */
  className?: string;
  /** Path (relative to content root) of the document being rendered, used
   * to resolve relative links and images. */
  documentPath?: string;
}

/** A lazily-loadable Markdown engine module. */
export interface RendererModule {
  default: ComponentType<MarkdownRenderProps>;
}

/** Registration entry for a Markdown engine. */
export interface RegisteredRenderer {
  /** Stable engine id, e.g. "react-markdown". */
  id: string;
  /** Human-readable engine label. */
  label: string;
  /** Lazy loader for the engine module (enables code splitting). */
  load: () => Promise<RendererModule>;
}

/** Raised when a renderer is missing, misconfigured or fails to load. */
export class RendererError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "RendererError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

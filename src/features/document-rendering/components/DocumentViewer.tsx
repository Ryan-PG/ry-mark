/**
 * DocumentViewer — the single entry point for rendering documents.
 *
 *   DocumentViewer
 *     ├── kind === "markdown" → MarkdownRendererAdapter (replaceable engine)
 *     └── kind === "html"     → HtmlDocument (isolated iframe)
 *
 * Callers pass a DocumentPayload + loaded source; they never touch a
 * specific engine or iframe internals.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import type { DocumentPayload } from "../core/types";
import { MarkdownRendererAdapter } from "../core/renderer-adapter";
import { HtmlDocument } from "./HtmlDocument";
import { ErrorState } from "./ErrorState";
import { contentUrlFor } from "../paths";

export interface DocumentViewerProps {
  document: DocumentPayload;
  /** Raw markdown source for markdown documents; ignored for HTML. */
  source: string;
}

export function DocumentViewer({ document, source }: DocumentViewerProps) {
  if (document.kind === "html") {
    return <HtmlDocument contentUrl={contentUrlFor(document.path)} title={document.title} />;
  }
  return (
    <div className="md-content">
      <MarkdownErrorBoundary>
        <MarkdownRendererAdapter source={source} documentPath={document.path} />
      </MarkdownErrorBoundary>
    </div>
  );
}


interface BoundaryState {
  error: Error | null;
}

/**
 * Local error boundary for the Markdown engine. Keeps rendering failures
 * contained inside the content pane.
 */
class MarkdownErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[rymark] Markdown rendering failed:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorState
          title="This document could not be rendered"
          description="The Markdown engine failed while rendering this document. The problem has been logged."
        />
      );
    }
    return this.props.children;
  }
}

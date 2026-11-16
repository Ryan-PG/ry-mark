/**
 * Renderer adapter: bridges the app to the active Markdown engine.
 *
 * The engine module is React.lazy-loaded (code splitting), wrapped in an
 * error boundary so a broken engine renders a readable error state instead
 * of crashing the whole app.
 */
import { lazy, Suspense, useMemo } from "react";
import { getActiveRenderer } from "./renderer-registry";
import { type MarkdownRenderProps, RendererError } from "./types";

function createLazyRendererComponent() {
  const renderer = getActiveRenderer();
  return lazy(async () => {
    try {
      return await renderer.load();
    } catch (error) {
      // Surface a meaningful, engine-independent failure.
      throw new RendererError(
        `Failed to load Markdown renderer "${renderer.id}".`,
        { cause: error },
      );
    }
  });
}

export function MarkdownRendererAdapter(props: MarkdownRenderProps) {
  const LazyRenderer = useMemo(createLazyRendererComponent, []);
  return (
    <Suspense fallback={<DocumentSkeleton />}>
      <LazyRenderer
        source={props.source}
        className={props.className}
        documentPath={props.documentPath}
      />
    </Suspense>
  );
}

/** Neutral skeleton shown while the engine chunk and document load. */
export function DocumentSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-4" aria-hidden="true">
      <div className="h-7 w-1/3 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-11/12 rounded bg-muted" />
      <div className="h-4 w-10/12 rounded bg-muted" />
      <div className="h-32 w-full rounded-lg bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-9/12 rounded bg-muted" />
    </div>
  );
}

/**
 * DocumentPage: loads a single document by route and renders it through the
 * DocumentViewer abstraction, with breadcrumb, title, TOC and state handling.
 *
 * The route is /doc/<content-relative-path> (URL-encoded per segment).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useContent } from "../content/content-context";
import {
  breadcrumbsFor,
  defaultDocumentPath,
  findDocument,
  neighborsOf,
} from "../content/navigation";
import {
  DocumentViewer,
  ErrorState,
  DocumentSkeleton,
  type DocumentPayload,
} from "../document-rendering";
import { extractHeadings } from "../document-rendering/headings";
import { fetchDocumentSource } from "../../lib/api";
import { TableOfContents } from "./TableOfContents";
import { cn } from "../../lib/utils";

export function DocumentPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { manifest, loading, error, reload } = useContent();
  const rawPath = params["*"] ?? "";

  const document = useMemo(() => {
    if (!manifest) return null;
    const found = findDocument(manifest.root, rawPath);
    if (!found) return null;
    // Map the manifest node to the renderer-agnostic payload shape.
    return {
      id: found.id,
      path: found.path,
      title: found.title,
      kind: found.type,
    } satisfies DocumentPayload;
  }, [manifest, rawPath]);

  // Redirect "/" to the default document.
  useEffect(() => {
    if (!manifest || rawPath !== "") return;
    const fallback = defaultDocumentPath(manifest.root);
    if (fallback) {
      navigate(`/doc/${fallback.split("/").map(encodeURIComponent).join("/")}`, { replace: true });
    }
  }, [manifest, rawPath, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <DocumentSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <ErrorState
          title="Could not load the content collection"
          description={error}
          onRetry={() => void reload()}
        />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <ErrorState
          title="Document not found"
          description={
            rawPath
              ? `No document exists at “${decodeURIComponent(rawPath)}”.`
              : "This content collection is empty. Add Markdown or HTML files to the content/ directory."
          }
        />
      </div>
    );
  }

  return <LoadedDocument document={document} />;
}

function LoadedDocument({ document }: { document: DocumentPayload }) {
  const { manifest } = useContent();
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (document.kind === "html") {
      // HTML documents are rendered directly by URL in an iframe; no fetch.
      setSource("");
      setError(null);
      return;
    }
    let cancelled = false;
    setSource(null);
    setError(null);
    fetchDocumentSource(document.path)
      .then((text) => {
        if (!cancelled) setSource(text);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load document.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [document.path, document.kind, reloadCounter]);

  const crumbs = breadcrumbsFor(document.path).slice(0, -1);
  const neighbors = manifest ? neighborsOf(manifest.root, document.path) : { prev: null, next: null };
  const headings = useMemo(
    () => (document.kind === "md" && source ? extractHeadings(source) : []),
    [document.kind, source],
  );

  return (
    <div className="mx-auto flex w-full max-w-full gap-10 px-5 py-8 sm:px-8 lg:px-10">
      <article className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {crumbs.map((crumb) => (
              <li key={crumb.path} className="flex items-center gap-1.5">
                <span>{crumb.title}</span>
                <span aria-hidden="true">/</span>
              </li>
            ))}
            <li>
              <span aria-current="page" className="font-medium text-foreground">
                {document.title}
              </span>
            </li>
          </ol>
        </nav>

        {/* Title */}
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-balance">{document.title}</h1>

        {error ? (
          <ErrorState
            title="Could not load this document"
            description={error}
            onRetry={() => setReloadCounter((value) => value + 1)}
          />
        ) : source === null ? (
          <DocumentSkeleton />
        ) : (
          <DocumentViewer document={document} source={source} />
        )}

        {/* Prev / next */}
        {document.kind === "md" && (neighbors.prev || neighbors.next) ? (
          <nav aria-label="Document navigation" className="mt-12 grid grid-cols-2 gap-4 border-t pt-6">
            {neighbors.prev ? (
              <Link
                to={`/doc/${neighbors.prev.path.split("/").map(encodeURIComponent).join("/")}`}
                className={cn(
                  "group flex flex-col gap-1 rounded-lg border p-4 text-sm transition-colors hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Previous
                </span>
                <span className="font-medium">{neighbors.prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {neighbors.next ? (
              <Link
                to={`/doc/${neighbors.next.path.split("/").map(encodeURIComponent).join("/")}`}
                className="group flex flex-col items-end gap-1 rounded-lg border p-4 text-right text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Next <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="font-medium">{neighbors.next.title}</span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>

      {/* Right sidebar TOC */}
      <aside className="hidden w-60 shrink-0 pt-16 xl:block">
        <div className="sticky top-16 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8">
          <TableOfContents headings={headings} />
        </div>
      </aside>
    </div>
  );
}

/**
 * document-rendering feature — public API.
 *
 * The rest of the application imports ONLY from this module. Everything
 * engine-specific (react-markdown, remark/rehype plugins, shiki, mermaid)
 * stays behind the registry + adapter boundary.
 */
export type {
  DocumentKind,
  DocumentPayload,
  MarkdownRenderProps,
  RegisteredRenderer,
  RendererModule,
} from "./core/types";
export { RendererError } from "./core/types";
export { registerRenderer, listRenderers, getRenderer, getActiveRenderer } from "./core/renderer-registry";
export { MarkdownRendererAdapter, DocumentSkeleton } from "./core/renderer-adapter";
export { DocumentViewer } from "./components/DocumentViewer";
export { HtmlDocument } from "./components/HtmlDocument";
export { ErrorState } from "./components/ErrorState";
export { contentUrlFor, docRouteFor, resolveRelativePath } from "./paths";
export { extractHeadings, type TocHeading } from "./headings";

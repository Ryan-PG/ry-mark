/**
 * react-markdown engine — the initial MarkdownRenderer implementation.
 *
 * This module is loaded lazily through the renderer registry; nothing else
 * in the app imports react-markdown or these plugins directly.
 */
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import "katex/dist/katex.min.css";
import { DocumentPathContext, componentMap } from "./components";
import { rehypePlugins, remarkPlugins } from "./plugins";
import type { MarkdownRenderProps } from "../../core/types";

function ReactMarkdownRenderer({ source, className, documentPath }: MarkdownRenderProps) {
  // Strip YAML frontmatter: it is metadata (already surfaced as the document
  // title) and must not leak into the rendered body.
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
  return (
    <DocumentPathContext.Provider value={documentPath}>
      <div className={className} data-renderer="react-markdown">
        <ReactMarkdown
          remarkPlugins={remarkPlugins as unknown as Options["remarkPlugins"]}
          rehypePlugins={rehypePlugins as unknown as Options["rehypePlugins"]}
          components={componentMap as unknown as Components}
        >
          {body}
        </ReactMarkdown>
      </div>
    </DocumentPathContext.Provider>
  );
}

export default ReactMarkdownRenderer;

/**
 * HTML document rendering — completely independent from the Markdown engine.
 *
 * HTML documents are shown as real documents inside an isolated iframe:
 * - The iframe loads the ORIGINAL content URL (/content/...), so relative
 *   CSS/image/asset paths and external stylesheets keep working.
 * - sandbox="allow-scripts" only: a unique opaque origin — no same-origin
 *   access, no DOM access to the parent, and critically NO access to the
 *   application's authentication cookie (HttpOnly anyway) or storage.
 * - No allow-forms / allow-popups / allow-top-navigation: embedded documents
 *   can run their own JS but cannot navigate the app or the parent frame.
 *
 * HTML documents are trusted project content, but they are still isolated
 * from the main application (see docs/AUTHENTICATION.md).
 */

export interface HtmlDocumentProps {
  /** The URL the HTML document is served from, e.g. /content/Tutorials/Networking.html */
  contentUrl: string;
  title: string;
}

export function HtmlDocument({ contentUrl, title }: HtmlDocumentProps) {
  return (
    <div className="html-document h-full min-h-0">
      <iframe
        src={contentUrl}
        title={title}
        sandbox="allow-scripts"
        loading="lazy"
        className="h-full min-h-[70vh] w-full rounded-lg border bg-white"
      />
    </div>
  );
}

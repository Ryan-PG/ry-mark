/**
 * Heading extraction for the table of contents.
 *
 * Runs on the raw markdown source (engine-independent by design): fenced
 * code blocks are masked first so headings inside them are ignored, then
 * ATX headings are scanned. Slug generation uses github-slugger — the exact
 * same library rehype-slug uses in the rendered output — so TOC anchors
 * always match rendered ids, including duplicate-heading suffixes.
 */
import GithubSlugger from "github-slugger";

export interface TocHeading {
  /** Anchor id, matching the id applied by rehype-slug in the rendered output. */
  id: string;
  text: string;
  /** 1-6 heading level. */
  level: number;
}

export function extractHeadings(source: string): TocHeading[] {
  const slugger = new GithubSlugger();
  const headings: TocHeading[] = [];

  // Mask fenced code blocks so their content is not scanned for headings.
  const masked = source
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/~~~[\s\S]*?~~~/g, (match) => match.replace(/[^\n]/g, " "));

  const pattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    const level = match[1]!.length;
    // Strip markdown emphasis and link syntax from the heading text.
    const text = match[2]!
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (!text) continue;
    headings.push({ id: slugger.slug(text), text, level });
  }
  return headings;
}

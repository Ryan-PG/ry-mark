/**
 * Client-side document search.
 *
 * The corpus is the build-time search index (auth-gated at runtime). Scoring:
 * term matches in the title weigh heavily, matches in body text are ranked by
 * frequency. Supports multi-term queries (AND semantics) and returns excerpts
 * with term positions for highlighting.
 */
import type { SearchIndexEntry } from "../../lib/api";

export interface SearchResult {
  entry: SearchIndexEntry;
  /** Relevance score (higher is better). */
  score: number;
  /** Text snippet around the first match, with the matched terms. */
  excerpt: string;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter((term) => term.length >= 2);
}

function buildExcerpt(text: string, terms: string[], radius = 60): string {
  const lower = text.toLowerCase();
  let firstIndex = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index !== -1 && (firstIndex === -1 || index < firstIndex)) firstIndex = index;
  }
  if (firstIndex === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, firstIndex - radius);
  const end = Math.min(text.length, firstIndex + radius * 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function searchDocuments(
  query: string,
  index: SearchIndexEntry[],
  limit = 20,
): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const entry of index) {
    const lowerTitle = entry.title.toLowerCase();
    const lowerText = entry.text.toLowerCase();
    let score = 0;
    let allMatched = true;

    for (const term of terms) {
      const titleMatches = lowerTitle.split(term).length - 1;
      const textMatches = lowerText.split(term).length - 1;
      if (titleMatches === 0 && textMatches === 0) {
        allMatched = false;
        break;
      }
      score += titleMatches * 40 + Math.min(textMatches, 20) * 2;
      if (lowerTitle.startsWith(term)) score += 15;
    }

    if (allMatched && score > 0) {
      results.push({ entry, score, excerpt: buildExcerpt(entry.text, terms) });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Splits text into parts with `matched: true` where any term occurs (for <mark>). */
export function highlightParts(text: string, query: string): { text: string; matched: boolean }[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [{ text, matched: false }];

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts: { text: string; matched: boolean }[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push({ text: text.slice(lastIndex, index), matched: false });
    parts.push({ text: match[0], matched: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), matched: false });
  return parts;
}

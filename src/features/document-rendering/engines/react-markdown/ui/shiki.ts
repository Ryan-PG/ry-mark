/**
 * Shiki syntax highlighting helper for the react-markdown engine.
 *
 * The full `shiki` package is loaded lazily on the first code block so the
 * initial application bundle never includes it. Results are cached globally
 * by (code, language) so re-renders are instant.
 */

export interface HighlightResult {
  html: string;
  ok: boolean;
}

let shikiPromise: Promise<typeof import("shiki")> | null = null;

function loadShiki(): Promise<typeof import("shiki")> {
  shikiPromise ??= import("shiki");
  return shikiPromise;
}

const cache = new Map<string, Promise<HighlightResult>>();

export function highlightCode(code: string, language: string): Promise<HighlightResult> {
  const key = `${language}\u0000${code}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = loadShiki()
    .then((shiki) =>
      shiki.codeToHtml(code, {
        lang: language,
        // Dual themes: light tokens inlined, dark tokens exposed as CSS vars
        // (see the .dark rules in index.css).
        themes: { light: "github-light", dark: "github-dark" },
      }),
    )
    .then((html) => ({ html, ok: true }) as HighlightResult)
    .catch(() => ({ html: "", ok: false }) as HighlightResult);

  cache.set(key, promise);
  // Bound the cache so very large content trees don't grow it without limit.
  if (cache.size > 300) {
    const first = cache.keys().next();
    if (!first.done) cache.delete(first.value);
  }
  return promise;
}

/** Supported language guard (shiki throws on unknown langs). */
export async function isSupportedLanguage(language: string): Promise<boolean> {
  try {
    const shiki = await loadShiki();
    const langs = shiki.bundledLanguages;
    return Object.prototype.hasOwnProperty.call(langs, language);
  } catch {
    return false;
  }
}

/** Renders highlighted HTML (or plain escaped text on failure) to React HTML. */
export function shikiToHtml(result: HighlightResult, code: string): string {
  if (result.ok && result.html) return result.html;
  // Fallback: plain <pre> with escaped text.
  const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre><code>${escaped}</code></pre>`;
}

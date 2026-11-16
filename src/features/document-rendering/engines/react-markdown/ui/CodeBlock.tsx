/**
 * CodeBlock: fenced code rendering with Shiki highlighting and a copy button.
 * Mermaid blocks are delegated to <Mermaid />. Plain code without a known
 * language falls back to a simple <pre>.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlightCode, shikiToHtml } from "./shiki";
import { Mermaid } from "./Mermaid";

export interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const isMermaid = language === "mermaid";
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const trimmedCode = useMemo(() => code.replace(/\n$/, ""), [code]);

  useEffect(() => {
    if (isMermaid || !language || language === "text" || language === "plaintext") {
      setHtml(null);
      return;
    }
    let cancelled = false;
    highlightCode(trimmedCode, language).then((result) => {
      if (!cancelled) setHtml(shikiToHtml(result, trimmedCode));
    });
    return () => {
      cancelled = true;
    };
  }, [trimmedCode, language, isMermaid]);

  if (isMermaid) {
    return <Mermaid code={trimmedCode} />;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trimmedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (permissions); ignore silently.
    }
  };

  return (
    <div className="code-block group my-5 overflow-hidden rounded-lg border bg-code-bg">
      <div className="flex items-center justify-between border-b border-code-border bg-surface/60 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language ?? "text"}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="shiki-wrapper">
        {html !== null ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre>
            <code>{trimmedCode}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

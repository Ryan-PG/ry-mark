/**
 * Mermaid diagram rendering with lazy engine loading.
 *
 * The `mermaid` package (~large) is imported only when the first diagram is
 * encountered. Theme follows the app's dark mode class. Render failures show
 * the source code instead of crashing the document.
 */
import { useEffect, useId, useState } from "react";

export interface MermaidProps {
  code: string;
}

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;
let initialized = false;

function loadMermaid(): Promise<typeof import("mermaid")> {
  mermaidPromise ??= import("mermaid").then((mermaid) => {
    if (!initialized) {
      mermaid.default.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {},
      });
      initialized = true;
    }
    return mermaid;
  });
  return mermaidPromise;
}

export function Mermaid({ code }: MermaidProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderId = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;

    const isDark = () => document.documentElement.classList.contains("dark");

    loadMermaid()
      .then(async (mermaid) => {
        const mermaidInstance = mermaid.default;
        mermaidInstance.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDark() ? "dark" : "default",
        });
        const { svg: rendered } = await mermaidInstance.render(`mermaid-${renderId}`, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Diagram failed to render.");
          setSvg(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  if (error) {
    return (
      <div className="my-5 rounded-lg border border-danger bg-danger-soft p-4 text-sm">
        <p className="font-medium text-danger">Mermaid diagram could not be rendered.</p>
        <pre className="mt-2 overflow-x-auto font-mono text-xs text-muted-foreground">{code}</pre>
      </div>
    );
  }

  if (svg === null) {
    return (
      <figure
        className="mermaid my-6 overflow-x-auto rounded-lg border bg-surface p-4 text-center"
        data-rendering="true"
        aria-live="polite"
      >
        <div className="py-8 text-sm text-muted-foreground">Rendering diagram…</div>
      </figure>
    );
  }

  return (
    <figure
      className="mermaid my-6 overflow-x-auto rounded-lg border bg-surface p-4 text-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * Contextual table of contents generated from markdown headings.
 * Hidden when there are too few headings or the viewport is narrow.
 * The active heading is tracked with IntersectionObserver.
 */
import { useEffect, useState } from "react";
import type { TocHeading } from "../../features/document-rendering/headings";
import { cn } from "../../lib/utils";

export interface TableOfContentsProps {
  headings: TocHeading[];
}

const MIN_HEADINGS = 3;

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  const trackable = headings.filter((h) => h.level >= 2 && h.level <= 3);
  if (trackable.length < MIN_HEADINGS) return null;

  return <TocWithObserver headings={trackable} activeId={activeId} setActiveId={setActiveId} />;
}

function TocWithObserver({
  headings,
  activeId,
  setActiveId,
}: {
  headings: TocHeading[];
  activeId: string | null;
  setActiveId: (id: string) => void;
}) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings, setActiveId]);

  return (
    <nav aria-label="Table of contents" className="hidden xl:block">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-2 border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth" });
                setActiveId(heading.id);
              }}
              className={cn(
                "-ml-px block border-l-2 py-0.5 text-[13px] leading-snug transition-colors",
                heading.level === 3 ? "pl-6" : "pl-3.5",
                activeId === heading.id
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

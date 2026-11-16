/**
 * Tabs (from :::tabs / ::tab directives) and Cards (from :::cards / ::card
 * directives) with local interactive state.
 */
import { useState, type ReactNode } from "react";

/* ---------------------------------- Tabs --------------------------------- */

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ items }: { items: TabItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const active = items.find((item) => item.id === activeId) ?? items[0];

  if (items.length === 0) return null;

  return (
    <div className="tabs my-5 rounded-lg border" data-tabs="">
      <div
        role="tablist"
        aria-label="Tabbed content"
        className="flex flex-wrap gap-1 border-b bg-muted/50 px-2 pt-2"
      >
        {items.map((item) => {
          const selected = item.id === active?.id;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActiveId(item.id)}
              className={`rounded-t-md border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-primary text-foreground bg-surface"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="px-4 py-3 text-sm">
        {active?.content}
      </div>
    </div>
  );
}

/* ---------------------------------- Cards -------------------------------- */

export interface CardItem {
  title?: string;
  content: ReactNode;
}

export function Cards({ items, columns = 2 }: { items: CardItem[]; columns?: 2 | 3 }) {
  if (items.length === 0) return null;
  return (
    <div
      className="cards my-5 grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      data-cards=""
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg border bg-surface p-4 transition-shadow hover:shadow-card"
        >
          {item.title ? <p className="mb-1.5 font-semibold">{item.title}</p> : null}
          <div className="text-sm text-muted-foreground [&>p]:my-1.5">{item.content}</div>
        </div>
      ))}
    </div>
  );
}

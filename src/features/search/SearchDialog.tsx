/**
 * Search dialog (command palette): keyboard-navigable client-side search
 * over the build-time index, with match highlighting.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Globe, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { highlightParts, searchDocuments } from "./search";
import { useContent } from "../content/content-context";
import { cn } from "../../lib/utils";

export interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { searchIndex } = useContent();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  const results = useMemo(
    () => (query.trim() && searchIndex ? searchDocuments(query, searchIndex) : []),
    [query, searchIndex],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Focus after the dialog mounts.
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const goToResult = useCallback(
    (index: number) => {
      const result = results[index];
      if (!result) return;
      onOpenChange(false);
      navigate(`/doc/${result.entry.path.split("/").map(encodeURIComponent).join("/")}`);
    },
    [results, navigate, onOpenChange],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((value) => Math.min(value + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((value) => Math.max(value - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        goToResult(selected);
      }
    },
    [results.length, selected, goToResult],
  );

  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected, results]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0" onKeyDown={onKeyDown} aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search documents</DialogTitle>
        <div className="flex items-center gap-2.5 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documentation…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="rymark-search-results"
            aria-activedescendant={results[selected] ? `search-result-${selected}` : undefined}
          />
          <kbd className="kbd shrink-0">Esc</kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {query.trim() === "" ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Type to search titles and document contents.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results for “{query}”.
            </p>
          ) : (
            <ul id="rymark-search-results" ref={listRef} role="listbox" aria-label="Search results">
              {results.map((result, index) => {
                const Icon = result.entry.type === "html" ? Globe : FileText;
                return (
                  <li key={result.entry.id}>
                    <button
                      type="button"
                      id={`search-result-${index}`}
                      role="option"
                      aria-selected={index === selected}
                      data-selected={index === selected}
                      onMouseEnter={() => setSelected(index)}
                      onClick={() => goToResult(index)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        index === selected ? "bg-primary-soft" : "hover:bg-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          index === selected ? "text-primary" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {highlightParts(result.entry.title, query).map((part, partIndex) =>
                            part.matched ? (
                              <mark key={partIndex} className="bg-primary-soft px-0.5 text-primary">
                                {part.text}
                              </mark>
                            ) : (
                              <span key={partIndex}>{part.text}</span>
                            ),
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {highlightParts(result.excerpt, query).map((part, partIndex) =>
                            part.matched ? (
                              <mark key={partIndex} className="bg-primary-soft px-0.5 text-primary">
                                {part.text}
                              </mark>
                            ) : (
                              <span key={partIndex}>{part.text}</span>
                            ),
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

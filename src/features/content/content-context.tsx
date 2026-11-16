/**
 * Manifest + search index context. Loaded once after the auth gate opens,
 * shared by the sidebar, document loader and search dialog.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchManifest,
  fetchSearchIndex,
  type ContentManifest,
  type SearchIndexEntry,
} from "../../lib/api";

interface ContentContextValue {
  manifest: ContentManifest | null;
  searchIndex: SearchIndexEntry[] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<ContentManifest | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Search index is lower priority: load manifest first, index after.
      const manifestResult = await fetchManifest();
      setManifest(manifestResult);
      setLoading(false);
      fetchSearchIndex()
        .then(setSearchIndex)
        .catch(() => setSearchIndex([])); // search is optional at runtime
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load content.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({ manifest, searchIndex, loading, error, reload: load }),
    [manifest, searchIndex, loading, error, load],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentContextValue {
  const context = useContext(ContentContext);
  if (!context) throw new Error("useContent must be used within <ContentProvider>.");
  return context;
}

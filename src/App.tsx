/**
 * Application shell: routes, auth gate, layout (sidebar + header + content),
 * global search dialog and keyboard shortcuts.
 */
import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/auth-context";
import { AuthGateScreen, LoginScreen } from "./features/auth/AuthScreens";
import { ContentProvider } from "./features/content/content-context";
import { DocumentPage } from "./features/document-view/DocumentPage";
import { Sidebar, SidebarTrigger } from "./features/navigation/Sidebar";
import { SearchDialog } from "./features/search/SearchDialog";
import { BrandMark } from "./features/navigation/Sidebar";
import "./features/document-rendering/bootstrap"; // registers the active Markdown renderer before first render
import { findDocument } from "./features/content/navigation";
import { useContent } from "./features/content/content-context";
import { useTheme } from "./hooks/use-theme";
import { ThemeToggle } from "./features/navigation/Sidebar";
import { breadcrumbsFor } from "./features/content/navigation";

function Shell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { manifest } = useContent();
  const { logout } = useAuth();

  const activePath = location.pathname.startsWith("/doc/")
    ? decodeURIComponent(location.pathname.slice("/doc/".length))
    : null;

  const activeDocument = activePath && manifest ? findDocument(manifest.root, activePath) : null;

  // Global search shortcut: Ctrl/Cmd+K. Close mobile nav on navigation.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    // Scroll the content pane to the top on navigation.
    document.getElementById("rymark-content")?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activePath={activePath}
        onNavigate={closeMobileNav}
        onOpenSearch={() => setSearchOpen(true)}
        mobileOpen={mobileNavOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-sidebar px-4 sm:px-6">
          <SidebarTrigger onOpen={() => setMobileNavOpen(true)} />
          <div className="flex items-center gap-2 lg:hidden">
            <BrandMark className="size-5" />
          </div>
          <BreadcrumbBar activePath={activePath} activeTitle={activeDocument?.title ?? null} />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Search (Ctrl+K)"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <ThemeToggle theme={theme} onToggle={toggle} />
            <button
              type="button"
              onClick={() => void logout()}
              className="hidden rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Content pane */}
        <main id="rymark-content" className="min-h-0 flex-1 overflow-y-auto bg-background">
          <Routes>
            <Route path="/" element={<DocumentPage />} />
            <Route path="/doc/*" element={<DocumentPage />} />
            <Route
              path="*"
              element={
                <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
                  Page not found.
                </div>
              }
            />
          </Routes>
        </main>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

/** Header breadcrumb (hidden on tiny screens where it would overflow). */
function BreadcrumbBar({ activePath, activeTitle }: { activePath: string | null; activeTitle: string | null }) {
  if (!activePath) return null;
  const crumbs = breadcrumbsFor(activePath).slice(0, -1);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="truncate">
          {crumb.title} <span aria-hidden="true">/</span>
        </span>
      ))}
      {activeTitle ? <span className="truncate font-medium text-foreground">{activeTitle}</span> : null}
    </nav>
  );
}

/** Gate: picks the right screen based on the auth configuration state. */
function GatedApp() {
  const { gate } = useAuth();

  if (gate.phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-10 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }
  if (gate.phase === "public" || gate.phase === "authenticated") {
    return (
      <ContentProvider>
        <Shell />
      </ContentProvider>
    );
  }
  if (gate.phase === "login") {
    return <LoginScreen />;
  }
  return (
    <AuthGateScreen
      phase={gate.phase as "unconfigured" | "malformed" | "missing-session-secret"}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GatedApp />
    </AuthProvider>
  );
}

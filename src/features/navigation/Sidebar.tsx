/**
 * Application sidebar: brand, search trigger, generated navigation tree and
 * account actions. On mobile it becomes an overlay drawer.
 */
import { Menu, Moon, Search, Sun, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useContent } from "../content/content-context";
import { useAuth } from "../auth/auth-context";
import { NavTree } from "./NavTree";
import { useTheme } from "../../hooks/use-theme";
import { cn } from "../../lib/utils";

export interface AppSidebarProps {
  activePath: string | null;
  onNavigate: () => void;
  onOpenSearch: () => void;
  /** Controlled open state for the mobile drawer. */
  mobileOpen: boolean;
}

export function Sidebar({
  activePath,
  onNavigate,
  onOpenSearch,
  mobileOpen,
}: AppSidebarProps) {
  const { manifest } = useContent();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onNavigate}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-sidebar transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Documentation sidebar"
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
          <BrandMark />
          <span className="font-semibold tracking-tight">Ry-Mark</span>
        </div>

        {/* Search trigger */}
        <div className="shrink-0 px-3 pt-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-9 w-full items-center gap-2 rounded-md border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground"
            aria-label="Search documents (opens dialog)"
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="kbd hidden sm:inline-block">Ctrl K</kbd>
          </button>
        </div>

        {/* Navigation tree */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {manifest ? (
            <NavTree nodes={manifest.root.children} activePath={activePath} />
          ) : (
            <div className="space-y-2 px-2 py-1" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 7}%` }} />
              ))}
            </div>
          )}
        </nav>

        {/* Footer actions */}
        <div className="flex shrink-0 items-center justify-between border-t px-3 py-2.5">
          <ThemeToggle theme={theme} onToggle={toggle} />
          <LogoutButton onLogout={logout} />
        </div>
      </aside>
    </>
  );
}

/** Small logo mark (inline SVG, CSP-safe). */
export function BrandMark({ className = "size-6" }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="14" fill="var(--primary)" />
      <g
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 17v32" />
        <path d="M22 17h7a9.5 9.5 0 0 1 0 19h-7" />
        <path d="M30.5 36l11 11" />
        <path d="M33.5 47h8v-8" />
      </g>
    </svg>
  );
}

export function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Log out of this browser"
    >
      <LogOut className="size-3.5" aria-hidden="true" />
      Log out
    </button>
  );
}

/** Hamburger trigger for the mobile drawer (used by the header). */
export function SidebarTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="size-4" aria-hidden="true" />
    </button>
  );
}

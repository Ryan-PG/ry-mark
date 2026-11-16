/**
 * Theme hook: light/dark toggle persisted to localStorage, with an initial
 * value resolved from the pre-paint script in index.html.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "rymark.theme";
export type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  useEffect(() => {
    // Keep hook state in sync with the class (e.g. initial script).
    setTheme(currentTheme());
  }, []);

  const apply = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable */
    }
    setTheme(next);
  }, []);

  const toggle = useCallback(() => {
    apply(currentTheme() === "dark" ? "light" : "dark");
  }, [apply]);

  return { theme, setTheme: apply, toggle };
}

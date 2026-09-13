"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/*
 * Three-state appearance, the way macOS and iOS do it: Light, Dark, and
 * Automatic. "Automatic" stores nothing but a marker and lets the OS decide, so
 * a phone switching to dark at sunset takes the site with it.
 *
 * The CSS in globals.css is already written for this: bare :root is light, a
 * prefers-color-scheme block covers Automatic, and [data-theme] wins over both.
 */

export type Theme = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

const STORAGE_KEY = "orbit.theme";

/**
 * Runs before first paint to stop a light flash on a dark-mode device. Kept as a
 * string because it has to be inlined into the document head, and deliberately
 * tiny: anything slow here delays the first paint of every page.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

type ThemeContext = {
  theme: Theme;
  resolved: Resolved;
  setTheme: (next: Theme) => void;
};

const Ctx = createContext<ThemeContext>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

function systemResolved(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Keeps the mobile browser chrome in step with the page background. */
function paintBrowserChrome(resolved: Resolved) {
  const color = resolved === "dark" ? "#000000" : "#ffffff";
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", color);
    meta.removeAttribute("media");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Starts at "system" on both server and client so hydration matches; the
  // effect below adopts the stored choice immediately afterwards. The inline
  // script has already painted the right colours, so nothing flashes.
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);

  useEffect(() => {
    let stored: Theme = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {
      /* storage blocked: stay on Automatic */
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);
    setSystemIsDark(systemResolved() === "dark");

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved = theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  useEffect(() => {
    apply(theme);
    paintBrowserChrome(resolved);
  }, [theme, resolved]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the choice still applies for this session */
    }
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

"use client";

import * as React from "react";

const DEFAULT_STORAGE_KEY = "theme";

export type ThemeProviderProps = {
  children: React.ReactNode;
  /** Tailwind class strategy — only `class` is supported (`.dark` on the root element) */
  attribute?: "class";
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
};

type ThemeContextValue = {
  theme: string | undefined;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  resolvedTheme: "light" | "dark" | undefined;
  themes: string[];
  systemTheme: "light" | "dark" | undefined;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveStoredToResolved(stored: string, enableSystem: boolean): "light" | "dark" {
  if (stored === "system") {
    return enableSystem ? getSystemTheme() : "light";
  }
  return stored === "dark" ? "dark" : "light";
}

function applyHtmlClass(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string | undefined>(undefined);
  /** Bumps when OS preference changes while theme is `system`, so consumers re-render */
  const [systemEpoch, setSystemEpoch] = React.useState(0);

  // Hydrate from localStorage once
  React.useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    let initial: string;
    if (raw === "light" || raw === "dark" || raw === "system") {
      initial = raw;
    } else if (defaultTheme === "light" || defaultTheme === "dark") {
      initial = defaultTheme;
    } else {
      initial = enableSystem ? "system" : "light";
    }
    if (initial === "system" && !enableSystem) {
      initial = "light";
    }
    setThemeState(initial);
  }, [defaultTheme, enableSystem, storageKey]);

  const resolvedTheme = React.useMemo(() => {
    if (theme === undefined) return undefined;
    void systemEpoch;
    return resolveStoredToResolved(theme, enableSystem);
  }, [theme, enableSystem, systemEpoch]);

  React.useEffect(() => {
    if (theme === undefined) return;
    applyHtmlClass(resolveStoredToResolved(theme, enableSystem));
    localStorage.setItem(storageKey, theme);
  }, [theme, enableSystem, storageKey]);

  React.useEffect(() => {
    if (theme !== "system" || !enableSystem) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setSystemEpoch((n) => n + 1);
      applyHtmlClass(getSystemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, enableSystem]);

  const setTheme = React.useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (value) => {
      setThemeState((prev) => {
        const base = prev ?? "light";
        return typeof value === "function" ? (value as (p: string) => string)(base) : value;
      });
    },
    [],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
      systemTheme: enableSystem ? getSystemTheme() : undefined,
    }),
    [theme, setTheme, resolvedTheme, enableSystem, systemEpoch],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

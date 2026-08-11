"use client";

import * as React from "react";

import {
  ACCENT_THEMES,
  applyAccentTheme,
  DEFAULT_ACCENT_ID,
  getAccentTheme,
  persistAccentTheme,
  readStoredAccentId,
  type AccentTheme,
  type AccentThemeId,
} from "@/lib/accent-theme";
import { useTheme } from "@/components/theme-provider";

type AccentThemeContextValue = {
  accentId: AccentThemeId;
  theme: AccentTheme;
  themes: AccentTheme[];
  setAccentId: (id: AccentThemeId) => void;
};

const AccentThemeContext = React.createContext<AccentThemeContextValue | null>(null);

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [accentId, setAccentIdState] = React.useState<AccentThemeId>(DEFAULT_ACCENT_ID);

  React.useEffect(() => {
    const id = readStoredAccentId();
    setAccentIdState(id);
    applyAccentTheme(id);
  }, []);

  // Re-apply soft accent tokens when light/dark mode flips.
  React.useEffect(() => {
    applyAccentTheme(accentId);
  }, [resolvedTheme, accentId]);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "profile_accent_theme") return;
      const next = readStoredAccentId();
      setAccentIdState(next);
      applyAccentTheme(next);
    };
    const onCustom = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      const next = getAccentTheme(id).id;
      setAccentIdState(next);
      applyAccentTheme(next);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("jwork:accent-theme", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("jwork:accent-theme", onCustom as EventListener);
    };
  }, []);

  const setAccentId = React.useCallback((id: AccentThemeId) => {
    setAccentIdState(id);
    persistAccentTheme(id);
  }, []);

  const value = React.useMemo<AccentThemeContextValue>(
    () => ({
      accentId,
      theme: getAccentTheme(accentId),
      themes: Object.values(ACCENT_THEMES),
      setAccentId,
    }),
    [accentId, setAccentId],
  );

  return (
    <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>
  );
}

export function useAccentTheme() {
  const ctx = React.useContext(AccentThemeContext);
  if (!ctx) {
    throw new Error("useAccentTheme must be used within AccentThemeProvider");
  }
  return ctx;
}

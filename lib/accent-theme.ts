/**
 * Global accent / brand theme.
 * Changing a theme writes CSS variables on <html> so every
 * `bg-primary`, `text-primary`, active nav link, button, etc. updates.
 */

export const ACCENT_STORAGE_KEY = "profile_accent_theme";

export type AccentThemeId =
  | "slate"
  | "sapphire"
  | "emerald"
  | "sunset"
  | "amethyst"
  | "rose"
  | "ocean"
  | "amber"
  | "crimson"
  | "indigo";

export type AccentTheme = {
  id: AccentThemeId;
  name: string;
  /** Hex for swatches + meta theme-color */
  swatch: string;
  /** oklch used for --primary / --ring / --sidebar-primary */
  primary: string;
  primaryForeground: string;
  /** Soft tint for --accent / --sidebar-accent (light mode) */
  accent: string;
  accentForeground: string;
  /** Soft tint for dark mode */
  darkAccent: string;
  darkAccentForeground: string;
  /** Hero banner gradients (profile / documents / change-password) */
  banner: string;
  colorCircle: string;
  accentText: string;
  accentBg: string;
  borderAccent: string;
  avatarRing: string;
  glassAccent: string;
  badgeAccent: string;
  cardHeaderBg: string;
  tabActive: string;
};

const primaryUi = {
  accentText: "text-primary",
  accentBg: "bg-primary/10",
  borderAccent: "border-primary/20 dark:border-primary/30",
  avatarRing: "ring-primary/80",
  glassAccent: "bg-primary/5",
  badgeAccent: "bg-primary/10 text-primary border-primary/20",
  cardHeaderBg: "bg-primary/5",
  tabActive: "bg-primary text-primary-foreground shadow-sm shadow-primary/25",
} as const;

export const ACCENT_THEMES: Record<AccentThemeId, AccentTheme> = {
  slate: {
    id: "slate",
    name: "Classic Slate",
    swatch: "#64748b",
    primary: "oklch(0.554 0.046 257.4)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.96 0.01 257)",
    accentForeground: "oklch(0.37 0.04 257)",
    darkAccent: "oklch(0.32 0.03 257)",
    darkAccentForeground: "oklch(0.9 0.02 257)",
    banner:
      "from-slate-800 via-slate-700 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white",
    colorCircle: "bg-slate-500",
    ...primaryUi,
  },
  sapphire: {
    id: "sapphire",
    name: "Sapphire Blue",
    swatch: "#3b82f6",
    primary: "oklch(0.623 0.188 259.8)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.03 250)",
    accentForeground: "oklch(0.38 0.14 265)",
    darkAccent: "oklch(0.38 0.14 265)",
    darkAccentForeground: "oklch(0.88 0.06 254)",
    banner:
      "from-blue-700 via-indigo-700 to-indigo-900 dark:from-blue-950 dark:via-indigo-950 dark:to-slate-950 text-white",
    colorCircle: "bg-blue-500",
    ...primaryUi,
  },
  emerald: {
    id: "emerald",
    name: "Emerald Forest",
    swatch: "#10b981",
    primary: "oklch(0.696 0.17 162.5)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.04 163)",
    accentForeground: "oklch(0.4 0.1 163)",
    darkAccent: "oklch(0.35 0.08 163)",
    darkAccentForeground: "oklch(0.9 0.05 163)",
    banner:
      "from-emerald-700 via-teal-700 to-teal-900 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-950 text-white",
    colorCircle: "bg-emerald-500",
    ...primaryUi,
  },
  sunset: {
    id: "sunset",
    name: "Sunset Glow",
    swatch: "#f43f5e",
    primary: "oklch(0.645 0.215 16.4)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.03 20)",
    accentForeground: "oklch(0.45 0.16 16)",
    darkAccent: "oklch(0.38 0.12 16)",
    darkAccentForeground: "oklch(0.92 0.04 16)",
    banner:
      "from-orange-600 via-rose-600 to-purple-950 dark:from-orange-950 dark:via-rose-950 dark:to-slate-950 text-white",
    colorCircle: "bg-rose-500",
    ...primaryUi,
  },
  amethyst: {
    id: "amethyst",
    name: "Royal Amethyst",
    swatch: "#a855f7",
    primary: "oklch(0.627 0.232 303.9)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.04 304)",
    accentForeground: "oklch(0.42 0.16 304)",
    darkAccent: "oklch(0.36 0.12 304)",
    darkAccentForeground: "oklch(0.92 0.05 304)",
    banner:
      "from-purple-700 via-fuchsia-700 to-indigo-950 dark:from-purple-950 dark:via-fuchsia-950 dark:to-slate-950 text-white",
    colorCircle: "bg-purple-500",
    ...primaryUi,
  },
  rose: {
    id: "rose",
    name: "Rose Gold",
    swatch: "#ec4899",
    primary: "oklch(0.656 0.211 354.3)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.03 350)",
    accentForeground: "oklch(0.45 0.16 350)",
    darkAccent: "oklch(0.38 0.12 350)",
    darkAccentForeground: "oklch(0.92 0.04 350)",
    banner:
      "from-pink-600 via-rose-500 to-slate-900 dark:from-pink-950 dark:via-rose-950 dark:to-slate-950 text-white",
    colorCircle: "bg-pink-500",
    ...primaryUi,
  },
  ocean: {
    id: "ocean",
    name: "Ocean Teal",
    swatch: "#0d9488",
    primary: "oklch(0.6 0.118 184.7)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.035 185)",
    accentForeground: "oklch(0.4 0.08 185)",
    darkAccent: "oklch(0.34 0.06 185)",
    darkAccentForeground: "oklch(0.9 0.04 185)",
    banner:
      "from-teal-700 via-cyan-700 to-slate-900 dark:from-teal-950 dark:via-cyan-950 dark:to-slate-950 text-white",
    colorCircle: "bg-teal-500",
    ...primaryUi,
  },
  amber: {
    id: "amber",
    name: "Amber Glow",
    swatch: "#d97706",
    primary: "oklch(0.666 0.157 58.3)",
    primaryForeground: "oklch(0.2 0.03 60)",
    accent: "oklch(0.96 0.04 85)",
    accentForeground: "oklch(0.45 0.12 55)",
    darkAccent: "oklch(0.36 0.08 55)",
    darkAccentForeground: "oklch(0.93 0.05 85)",
    banner:
      "from-amber-600 via-orange-600 to-stone-900 dark:from-amber-950 dark:via-orange-950 dark:to-slate-950 text-white",
    colorCircle: "bg-amber-500",
    ...primaryUi,
  },
  crimson: {
    id: "crimson",
    name: "Crimson Pulse",
    swatch: "#dc2626",
    primary: "oklch(0.577 0.215 27.3)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.03 25)",
    accentForeground: "oklch(0.42 0.16 25)",
    darkAccent: "oklch(0.36 0.12 25)",
    darkAccentForeground: "oklch(0.92 0.04 25)",
    banner:
      "from-red-700 via-rose-700 to-stone-950 dark:from-red-950 dark:via-rose-950 dark:to-slate-950 text-white",
    colorCircle: "bg-red-600",
    ...primaryUi,
  },
  indigo: {
    id: "indigo",
    name: "Midnight Indigo",
    swatch: "#4f46e5",
    primary: "oklch(0.511 0.222 276.9)",
    primaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.95 0.035 277)",
    accentForeground: "oklch(0.38 0.14 277)",
    darkAccent: "oklch(0.35 0.12 277)",
    darkAccentForeground: "oklch(0.9 0.05 277)",
    banner:
      "from-indigo-700 via-violet-800 to-slate-950 dark:from-indigo-950 dark:via-violet-950 dark:to-slate-950 text-white",
    colorCircle: "bg-indigo-500",
    ...primaryUi,
  },
};

/** Matches app brand / viewport themeColor until user picks another. */
export const DEFAULT_ACCENT_ID: AccentThemeId = "rose";

export function isAccentThemeId(value: unknown): value is AccentThemeId {
  return typeof value === "string" && value in ACCENT_THEMES;
}

export function getAccentTheme(id?: string | null): AccentTheme {
  if (id && isAccentThemeId(id)) return ACCENT_THEMES[id];
  return ACCENT_THEMES[DEFAULT_ACCENT_ID];
}

export function readStoredAccentId(): AccentThemeId {
  if (typeof window === "undefined") return DEFAULT_ACCENT_ID;
  try {
    const raw = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentThemeId(raw)) return raw;
  } catch {
    // private mode / blocked storage
  }
  return DEFAULT_ACCENT_ID;
}

export function applyAccentTheme(id: string | null | undefined): AccentTheme {
  const theme = getAccentTheme(id);
  if (typeof document === "undefined") return theme;

  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-foreground", theme.primaryForeground);
  root.style.setProperty("--ring", theme.primary);
  root.style.setProperty("--sidebar-primary", theme.primary);
  root.style.setProperty("--sidebar-primary-foreground", theme.primaryForeground);
  root.style.setProperty("--sidebar-ring", theme.primary);
  root.style.setProperty("--chart-1", theme.primary);

  if (isDark) {
    root.style.setProperty("--accent", theme.darkAccent);
    root.style.setProperty("--accent-foreground", theme.darkAccentForeground);
    root.style.setProperty("--sidebar-accent", theme.darkAccent);
    root.style.setProperty("--sidebar-accent-foreground", theme.darkAccentForeground);
  } else {
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-foreground", theme.accentForeground);
    root.style.setProperty("--sidebar-accent", theme.accent);
    root.style.setProperty("--sidebar-accent-foreground", theme.accentForeground);
  }

  root.dataset.accent = theme.id;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.swatch);

  return theme;
}

export function persistAccentTheme(id: AccentThemeId): AccentTheme {
  const theme = applyAccentTheme(id);
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, theme.id);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("jwork:accent-theme", { detail: { id: theme.id } }),
    );
  }
  return theme;
}

/** Inline bootstrap script — prevents flash of wrong brand color. */
export const ACCENT_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(ACCENT_STORAGE_KEY)};var d=${JSON.stringify(DEFAULT_ACCENT_ID)};var map=${JSON.stringify(
  Object.fromEntries(
    Object.values(ACCENT_THEMES).map((t) => [
      t.id,
      {
        p: t.primary,
        pf: t.primaryForeground,
        a: t.accent,
        af: t.accentForeground,
        da: t.darkAccent,
        daf: t.darkAccentForeground,
        s: t.swatch,
      },
    ]),
  ),
)};var id=localStorage.getItem(k)||d;var t=map[id]||map[d];if(!t)return;var r=document.documentElement;var dark=r.classList.contains("dark");r.style.setProperty("--primary",t.p);r.style.setProperty("--primary-foreground",t.pf);r.style.setProperty("--ring",t.p);r.style.setProperty("--sidebar-primary",t.p);r.style.setProperty("--sidebar-primary-foreground",t.pf);r.style.setProperty("--sidebar-ring",t.p);r.style.setProperty("--chart-1",t.p);r.style.setProperty("--accent",dark?t.da:t.a);r.style.setProperty("--accent-foreground",dark?t.daf:t.af);r.style.setProperty("--sidebar-accent",dark?t.da:t.a);r.style.setProperty("--sidebar-accent-foreground",dark?t.daf:t.af);r.dataset.accent=id;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t.s);}catch(e){}})();`;

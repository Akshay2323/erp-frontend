import type { GuidanceCopy, GuidanceLocale } from "../types";
import en from "./en";
import gu from "./gu";
import hi from "./hi";

const copies: Record<GuidanceLocale, GuidanceCopy> = {
  en,
  hi,
  gu,
};

export const GUIDANCE_LOCALE_STORAGE_KEY = "user_guidance_locale";

export const GUIDANCE_LOCALE_OPTIONS: Array<{
  value: GuidanceLocale;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "gu", label: "ગુજરાતી" },
];

export function getGuidanceCopy(locale: GuidanceLocale): GuidanceCopy {
  return copies[locale] ?? copies.en;
}

export function isGuidanceLocale(value: string): value is GuidanceLocale {
  return value === "en" || value === "hi" || value === "gu";
}

export function readStoredGuidanceLocale(): GuidanceLocale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem(GUIDANCE_LOCALE_STORAGE_KEY);
    if (raw && isGuidanceLocale(raw)) return raw;
  } catch {
    // ignore
  }
  return "en";
}

export function storeGuidanceLocale(locale: GuidanceLocale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUIDANCE_LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

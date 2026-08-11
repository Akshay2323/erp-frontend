import type { GuidancePlatform } from "./types";

export function detectGuidancePlatform(): GuidancePlatform {
  if (typeof navigator === "undefined") return "desktop";

  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function getPlatformLabelKey(
  platform: GuidancePlatform,
): "platformIos" | "platformAndroid" | "platformDesktop" {
  if (platform === "ios") return "platformIos";
  if (platform === "android") return "platformAndroid";
  return "platformDesktop";
}

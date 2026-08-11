export type GuidanceLocale = "en" | "hi" | "gu";

export type GuidancePlatform = "ios" | "android" | "desktop";

export type GuidanceTopic = "location" | "camera" | "install";

export type GuidanceStep = {
  title: string;
  body: string;
};

export type GuidanceTopicContent = {
  title: string;
  description: string;
  steps: GuidanceStep[];
  tips: string[];
};

export type GuidanceUiCopy = {
  pageTitle: string;
  pageSubtitle: string;
  languageLabel: string;
  platformLabel: string;
  platformAuto: string;
  platformIos: string;
  platformAndroid: string;
  platformDesktop: string;
  viewingOn: string;
  tipsTitle: string;
  locationTab: string;
  cameraTab: string;
  installTab: string;
  backToLogin: string;
  openInApp: string;
};

export type GuidanceCopy = {
  ui: GuidanceUiCopy;
  topics: Record<GuidanceTopic, Record<GuidancePlatform, GuidanceTopicContent>>;
};

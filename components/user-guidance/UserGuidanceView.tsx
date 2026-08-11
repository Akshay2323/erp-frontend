"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import {
  Camera,
  Download,
  MapPin,
  Monitor,
  Smartphone,
  TabletSmartphone,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { detectGuidancePlatform } from "@/lib/user-guidance/detect-platform";
import {
  getGuidanceCopy,
  GUIDANCE_LOCALE_OPTIONS,
  readStoredGuidanceLocale,
  storeGuidanceLocale,
} from "@/lib/user-guidance/translations";
import type { GuidancePlatform, GuidanceTopic } from "@/lib/user-guidance/types";

type UserGuidanceViewProps = {
  showAuthLinks?: boolean;
};

const topicMeta: Record<
  GuidanceTopic,
  { icon: typeof MapPin; accent: string }
> = {
  location: { icon: MapPin, accent: "text-emerald-600 bg-emerald-500/10" },
  camera: { icon: Camera, accent: "text-sky-600 bg-sky-500/10" },
  install: { icon: Download, accent: "text-violet-600 bg-violet-500/10" },
};

const platformIcons: Record<GuidancePlatform, typeof Monitor> = {
  ios: TabletSmartphone,
  android: Smartphone,
  desktop: Monitor,
};

export function UserGuidanceView({ showAuthLinks }: UserGuidanceViewProps) {
  const [locale, setLocale] = useState<"en" | "hi" | "gu">("en");
  const [platformMode, setPlatformMode] = useState<"auto" | GuidancePlatform>("auto");
  const [activeTopic, setActiveTopic] = useState<GuidanceTopic>("location");
  const [detectedPlatform, setDetectedPlatform] = useState<GuidancePlatform>("desktop");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setLocale(readStoredGuidanceLocale());
    setDetectedPlatform(detectGuidancePlatform());
    setIsAuthenticated(Boolean(Cookies.get("auth_token")));
  }, []);

  const copy = useMemo(() => getGuidanceCopy(locale), [locale]);
  const activePlatform =
    platformMode === "auto" ? detectedPlatform : platformMode;
  const platformLabel =
    activePlatform === "ios"
      ? copy.ui.platformIos
      : activePlatform === "android"
        ? copy.ui.platformAndroid
        : copy.ui.platformDesktop;
  const topicContent = copy.topics[activeTopic][activePlatform];
  const TopicIcon = topicMeta[activeTopic].icon;
  const PlatformIcon = platformIcons[activePlatform];

  const handleLocaleChange = (next: "en" | "hi" | "gu") => {
    setLocale(next);
    storeGuidanceLocale(next);
  };

  const showLinks = showAuthLinks ?? !isAuthenticated;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {copy.ui.pageTitle}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {copy.ui.pageSubtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{copy.ui.languageLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {GUIDANCE_LOCALE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={locale === option.value ? "default" : "outline"}
                onClick={() => handleLocaleChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{copy.ui.platformLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={platformMode === "auto" ? "default" : "outline"}
              onClick={() => setPlatformMode("auto")}
            >
              {copy.ui.platformAuto}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={platformMode === "ios" ? "default" : "outline"}
              onClick={() => setPlatformMode("ios")}
            >
              {copy.ui.platformIos}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={platformMode === "android" ? "default" : "outline"}
              onClick={() => setPlatformMode("android")}
            >
              {copy.ui.platformAndroid}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={platformMode === "desktop" ? "default" : "outline"}
              onClick={() => setPlatformMode("desktop")}
            >
              {copy.ui.platformDesktop}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["location", "camera", "install"] as GuidanceTopic[]).map((topic) => {
          const Icon = topicMeta[topic].icon;
          const label =
            topic === "location"
              ? copy.ui.locationTab
              : topic === "camera"
                ? copy.ui.cameraTab
                : copy.ui.installTab;
          return (
            <Button
              key={topic}
              type="button"
              variant={activeTopic === topic ? "default" : "outline"}
              className="gap-2 rounded-xl"
              onClick={() => setActiveTopic(topic)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          );
        })}
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                topicMeta[activeTopic].accent,
              )}
            >
              <TopicIcon className="h-3.5 w-3.5" />
              {topicContent.title}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <PlatformIcon className="h-3.5 w-3.5" />
              {copy.ui.viewingOn}: {platformLabel}
            </span>
          </div>
          <CardTitle className="text-xl">{topicContent.title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {topicContent.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            {topicContent.steps.map((step, index) => (
              <li
                key={`${activeTopic}-${activePlatform}-${index}`}
                className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {topicContent.tips.length > 0 ? (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {copy.ui.tipsTitle}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {topicContent.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showLinks ? (
        <div className="flex flex-wrap gap-3">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/login"
          >
            {copy.ui.backToLogin}
          </Link>
          {isAuthenticated ? (
            <Link
              className={buttonVariants({ variant: "default" })}
              href="/employee-dashboard"
            >
              {copy.ui.openInApp}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

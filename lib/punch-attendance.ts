import {
  getPermanentPermissionHelp,
  rememberPermissionGranted,
  requestPersistentStorage,
} from "@/lib/permissions/device-permissions";

export type GeoCoords = {
  latitude: number;
  longitude: number;
};

export type GeoPositionFailureReason =
  | "unsupported"
  | "denied"
  | "timeout"
  | "unavailable";

export type GeoPositionResult =
  | { ok: true; coords: GeoCoords; accuracy?: number }
  | { ok: false; reason: GeoPositionFailureReason };

export type CameraAccessResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: "insecure" | "unsupported" | "denied" | "not-found" | "in-use" | "failed"; details?: string };

const PUNCH_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 25000,
  maximumAge: 0,
};

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function hasSecureMediaContext(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

export function getSiteHostname(): string {
  if (typeof window === "undefined") return "this website";
  return window.location.hostname || "this website";
}

export function getCameraPermissionHelp(): string {
  return getPermanentPermissionHelp("camera");
}

export function getLocationPermissionHelp(): string {
  return `${getPermanentPermissionHelp("geolocation")} Also make sure phone GPS is turned on.`;
}

function getUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyGetUserMedia =
    (
      navigator as Navigator & {
        getUserMedia?: typeof navigator.mediaDevices.getUserMedia;
        webkitGetUserMedia?: typeof navigator.mediaDevices.getUserMedia;
      }
    ).getUserMedia ??
    (
      navigator as Navigator & {
        webkitGetUserMedia?: typeof navigator.mediaDevices.getUserMedia;
      }
    ).webkitGetUserMedia;

  if (!legacyGetUserMedia) {
    return Promise.reject(new Error("unsupported"));
  }

  return new Promise((resolve, reject) => {
    (
      legacyGetUserMedia as (
        constraints: MediaStreamConstraints,
        success: (stream: MediaStream) => void,
        error: (err: unknown) => void,
      ) => void
    ).call(navigator, constraints, resolve, reject);
  });
}

export type CameraFacingMode = "user" | "environment";

export type AcquireCameraStreamOptions = {
  /** `user` = front/selfie, `environment` = back/rear camera */
  facingMode?: CameraFacingMode;
  /** When true, try the other facing mode if the preferred one is unavailable */
  allowFacingFallback?: boolean;
};

export async function acquireCameraStream(
  options: AcquireCameraStreamOptions = {},
): Promise<CameraAccessResult> {
  if (!hasSecureMediaContext()) {
    return { ok: false, reason: "insecure" };
  }

  const preferred = options.facingMode ?? "user";
  const allowFacingFallback = options.allowFacingFallback ?? preferred === "user";
  const facings: CameraFacingMode[] = allowFacingFallback
    ? preferred === "user"
      ? ["user", "environment"]
      : ["environment", "user"]
    : [preferred];

  const attempts: MediaStreamConstraints[] = [];
  for (const facing of facings) {
    attempts.push(
      {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: { facingMode: facing }, audio: false },
    );
  }
  attempts.push({ video: true, audio: false });

  let lastError: unknown;

  for (const constraints of attempts) {
    try {
      const stream = await getUserMedia(constraints);
      // Snapshot the grant + pin site data so browsers (Samsung Internet
      // especially) don't evict it and re-prompt on the next punch.
      rememberPermissionGranted("camera");
      void requestPersistentStorage();
      return { ok: true, stream };
    } catch (error) {
      lastError = error;
    }
  }

  const name =
    lastError instanceof DOMException
      ? lastError.name
      : typeof lastError === "object" &&
          lastError &&
          "name" in lastError &&
          typeof (lastError as { name: unknown }).name === "string"
        ? (lastError as { name: string }).name
        : "";
  const message =
    lastError instanceof Error
      ? lastError.message
      : String(lastError || "");
  const details = lastError ? `${name}: ${message}` : undefined;

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return { ok: false, reason: "denied", details };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { ok: false, reason: "not-found", details };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return { ok: false, reason: "in-use", details };
  }

  return { ok: false, reason: "failed", details };
}

/**
 * Always reads a fresh GPS fix (never cached) — required on every punch in/out.
 */
export function acquireFreshPunchPosition(): Promise<GeoPositionResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let reason: GeoPositionFailureReason = "unavailable";
        if (error.code === error.PERMISSION_DENIED) reason = "denied";
        else if (error.code === error.TIMEOUT) reason = "timeout";
        resolve({ ok: false, reason });
      },
      PUNCH_GEO_OPTIONS,
    );
  });
}

/** @deprecated Use acquireFreshPunchPosition for punch flows. */
export function acquireCurrentPosition(): Promise<GeoCoords | null> {
  return acquireFreshPunchPosition().then((result) =>
    result.ok ? result.coords : null,
  );
}

export async function attachStreamToVideo(
  stream: MediaStream,
  video: HTMLVideoElement,
): Promise<void> {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");

  try {
    await video.play();
  } catch {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        video.removeEventListener("loadedmetadata", onReady);
        void video.play().finally(() => resolve());
      };
      video.addEventListener("loadedmetadata", onReady);
      setTimeout(() => resolve(), 300);
    });
  }
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function captureVideoFrameToFile(
  video: HTMLVideoElement,
  fileName = "profile-photo-capture.jpg",
): Promise<File | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(
          new File([blob], fileName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        );
      },
      "image/jpeg",
      0.92,
    );
  });
}

"use client";

import {
  AlertCircle,
  Camera,
  ImageIcon,
  RotateCcw,
  RotateCw,
  SwitchCamera,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acquireCameraStream,
  attachStreamToVideo,
  captureVideoFrameToFile,
  getCameraPermissionHelp,
  stopMediaStream,
  type CameraAccessResult,
  type CameraFacingMode,
} from "@/lib/punch-attendance";
import { cn } from "@/lib/utils";

type ProfilePhotoCropperProps = {
  value?: File;
  onChange: (file: File | undefined) => void;
  error?: string;
  existingPhotoUrl?: string | null;
  authToken?: string;
  employeeName?: string;
  onExistingPhotoUpdated?: (url: string | null) => void;
};

const OUTPUT_SIZE = 512;
const VIEWPORT_SIZE = 280;

export function ProfilePhotoCropper({
  value,
  onChange,
  error,
  existingPhotoUrl,
  authToken,
  employeeName,
  onExistingPhotoUpdated,
}: ProfilePhotoCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [existingPreviewSrc, setExistingPreviewSrc] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existingLoadFailed, setExistingLoadFailed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacingMode>("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<
    "" | Extract<CameraAccessResult, { ok: false }>["reason"]
  >("");
  const [cameraErrorDetails, setCameraErrorDetails] = useState<string>("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!value) {
      setImageSrc(null);
      setRotation(0);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const url = URL.createObjectURL(value);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => {
    if (!existingPhotoUrl || value) {
      setExistingPreviewSrc(null);
      setExistingLoadFailed(false);
      setLoadingExisting(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const loadExisting = async () => {
      setLoadingExisting(true);
      setExistingLoadFailed(false);
      try {
        const headers: HeadersInit = { Accept: "image/*" };
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }
        const response = await fetch(existingPhotoUrl, {
          headers,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Unable to load profile photo");
        }
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setExistingPreviewSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setExistingPreviewSrc(null);
          setExistingLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    };

    void loadExisting();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authToken, existingPhotoUrl, value]);

  const resetTransforms = () => {
    setRotation(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleFilePick = (file?: File) => {
    if (!file) return;
    onChange(file);
    resetTransforms();
  };

  const closeCameraModal = useCallback(() => {
    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);
    setShowCameraModal(false);
    setCameraError("");
    setCameraErrorDetails("");
    setCameraLoading(false);
    setCapturingPhoto(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: CameraFacingMode) => {
    setCameraLoading(true);
    setCameraError("");
    setCameraErrorDetails("");
    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);

    const result = await acquireCameraStream({
      facingMode: facing,
      allowFacingFallback: true,
    });

    if (!result.ok) {
      setCameraError(result.reason);
      setCameraErrorDetails(result.details || "");
      setCameraLoading(false);
      return;
    }

    cameraStreamRef.current = result.stream;
    setCameraStream(result.stream);
    setCameraFacing(facing);

    const video = videoRef.current;
    if (video) {
      try {
        await attachStreamToVideo(result.stream, video);
      } catch {
        setCameraError("failed");
        setCameraErrorDetails("attachStreamToVideo failed");
        stopMediaStream(result.stream);
        cameraStreamRef.current = null;
        setCameraStream(null);
      }
    }

    setCameraLoading(false);
  }, []);

  const openCameraModal = () => {
    setCameraFacing("environment");
    setShowCameraModal(true);
  };

  const switchCamera = () => {
    const nextFacing: CameraFacingMode =
      cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    void startCamera(nextFacing);
  };

  useEffect(() => {
    if (!showCameraModal) return;
    void startCamera("environment");
    setCameraFacing("environment");
  }, [showCameraModal, startCamera]);

  useEffect(() => {
    if (!showCameraModal) return;
    return () => {
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
    };
  }, [showCameraModal]);

  const handleCaptureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || cameraError) return;

    setCapturingPhoto(true);
    try {
      const file = await captureVideoFrameToFile(
        video,
        `profile-photo-${cameraFacing}.jpg`,
      );
      if (!file) {
        setCameraError("failed");
        return;
      }
      handleFilePick(file);
      closeCameraModal();
    } finally {
      setCapturingPhoto(false);
    }
  };

  const exportCroppedFile = useCallback(async (): Promise<File | null> => {
    if (!imageSrc || !imageRef.current) return null;

    const img = imageRef.current;
    await new Promise<void>((resolve) => {
      if (img.complete) resolve();
      else img.onload = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const viewportToOutput = OUTPUT_SIZE / VIEWPORT_SIZE;
    ctx.save();
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale * viewportToOutput, scale * viewportToOutput);
    ctx.drawImage(
      img,
      -img.naturalWidth / 2 + offset.x,
      -img.naturalHeight / 2 + offset.y,
    );
    ctx.restore();

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(
            new File(
              [blob],
              value?.name?.replace(/\.\w+$/, "") + "-cropped.jpg" || "profile-photo.jpg",
              {
                type: "image/jpeg",
                lastModified: Date.now(),
              },
            ),
          );
        },
        "image/jpeg",
        0.92,
      );
    });
  }, [imageSrc, offset.x, offset.y, rotation, scale, value?.name]);

  const applyCrop = async () => {
    const cropped = await exportCroppedFile();
    if (cropped) onChange(cropped);
  };

  const clearNewPhoto = () => {
    onChange(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraFileInputRef.current) cameraFileInputRef.current.value = "";
    resetTransforms();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSrc) return;
    setDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.offsetX + (event.clientX - dragStart.current.x),
      y: dragStart.current.offsetY + (event.clientY - dragStart.current.y),
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const hasExistingPhoto = Boolean(existingPhotoUrl);
  const showExistingPreview = hasExistingPhoto && !value;
  const initials = (employeeName || "Employee")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const mirrorCameraPreview = cameraFacing === "user";

  return (
    <>
      <div className="mx-auto max-w-md space-y-5">
        {showExistingPreview ? (
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Current profile photo</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted shadow-sm">
                {loadingExisting ? (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    Loading…
                  </div>
                ) : existingPreviewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Current profile photo"
                    className="h-full w-full object-cover"
                    src={existingPreviewSrc}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-primary/10 text-primary">
                    {existingLoadFailed ? (
                      <>
                        <ImageIcon className="h-6 w-6 opacity-70" />
                        <span className="px-2 text-center text-[10px] font-medium text-muted-foreground">
                          Photo saved on server
                        </span>
                      </>
                    ) : (
                      <span className="text-xl font-bold">{initials}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-sm text-foreground">
                  This employee already has a profile photo on file.
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload or capture a new image below to replace it. The current photo stays until you save a new one.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <Input
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFilePick(e.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
          <Input
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilePick(e.target.files?.[0])}
            ref={cameraFileInputRef}
            type="file"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => fileInputRef.current?.click()} type="button" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              {value ? "Choose another photo" : hasExistingPhoto ? "Upload new photo" : "Upload photo"}
            </Button>
            <Button onClick={openCameraModal} type="button" variant="outline">
              <Camera className="mr-2 h-4 w-4" />
              {value ? "Retake with camera" : "Capture with camera"}
            </Button>
            {value ? (
              <Button onClick={clearNewPhoto} type="button" variant="ghost">
                {hasExistingPhoto ? "Cancel new photo" : "Remove"}
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {hasExistingPhoto
              ? "Optional. Upload from gallery or capture with the back camera, then crop before saving."
              : "Optional. Upload from gallery or capture with the back camera (switch to front if needed), then crop."}
          </p>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {imageSrc ? (
          <>
            {hasExistingPhoto ? (
              <p className="text-sm font-medium text-foreground">New photo preview</p>
            ) : null}
            <div
              className={cn(
                "relative mx-auto overflow-hidden rounded-2xl border border-border bg-muted/30",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Crop preview"
                className="pointer-events-none absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
                draggable={false}
                ref={imageRef}
                src={imageSrc}
                style={{
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${scale})`,
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary/40 ring-inset" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setRotation((r) => r - 90)} size="sm" type="button" variant="outline">
                <RotateCcw className="mr-1 h-4 w-4" />
                Rotate left
              </Button>
              <Button onClick={() => setRotation((r) => r + 90)} size="sm" type="button" variant="outline">
                <RotateCw className="mr-1 h-4 w-4" />
                Rotate right
              </Button>
              <Button onClick={resetTransforms} size="sm" type="button" variant="ghost">
                Reset
              </Button>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Zoom</label>
              <input
                className="mt-1 w-full accent-primary"
                max={3}
                min={0.5}
                onChange={(e) => setScale(Number(e.target.value))}
                step={0.05}
                type="range"
                value={scale}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={clearNewPhoto} type="button" variant="outline">
                {hasExistingPhoto ? "Cancel new photo" : "Remove"}
              </Button>
              <Button
                onClick={() => {
                  void applyCrop().then(() => {
                    if (hasExistingPhoto) {
                      onExistingPhotoUpdated?.(existingPhotoUrl ?? null);
                    }
                  });
                }}
                type="button"
              >
                Apply crop
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {showCameraModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            role="dialog"
          >
            <div className="border-b border-border p-4">
              <h3 className="text-lg font-semibold">Capture profile photo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {cameraFacing === "environment"
                  ? "Using back camera. Position the employee in the frame."
                  : "Using front camera. You can switch back to the rear camera."}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 p-4">
              {cameraError ? (
                <div className="flex w-full flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">
                      {cameraError === "insecure"
                        ? "Secure connection required"
                        : cameraError === "denied"
                          ? "Camera access denied"
                          : cameraError === "not-found"
                            ? "Camera not detected"
                            : cameraError === "in-use"
                              ? "Camera already in use"
                              : "Camera initialization failed"}
                    </p>
                    <p className="max-w-[320px] text-xs text-muted-foreground leading-relaxed">
                      {cameraError === "insecure" ? (
                        "Open this app using HTTPS, then try again."
                      ) : cameraError === "unsupported" ? (
                        "This browser does not support in-app camera capture. Use Upload photo instead."
                      ) : cameraError === "denied" ? (
                        "Click the lock icon in the address bar → Site settings → Camera → Allow."
                      ) : cameraError === "not-found" ? (
                        "We couldn't detect any camera hardware. Please plug in a webcam or verify it is enabled in your system settings."
                      ) : cameraError === "in-use" ? (
                        "The webcam is being used by another application (e.g. Zoom, Teams, Skype, or another browser tab). Please close it and try again."
                      ) : (
                        `Unable to initialize your webcam. ${cameraErrorDetails ? `Details: ${cameraErrorDetails}` : ""}`
                      )}
                    </p>
                    {cameraErrorDetails && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Error details: {cameraErrorDetails}
                      </p>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    <Button
                      className="w-full"
                      onClick={() => void startCamera(cameraFacing)}
                      type="button"
                      variant="outline"
                    >
                      Try again
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => cameraFileInputRef.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      Use device camera app
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative aspect-[4/3] w-full max-w-[360px] overflow-hidden rounded-2xl border border-border bg-muted">
                    {cameraLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                        Starting camera…
                      </div>
                    ) : null}
                    <video
                      ref={videoRef}
                      autoPlay
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      style={{ transform: mirrorCameraPreview ? "scaleX(-1)" : undefined }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {cameraFacing === "environment" ? "Back camera" : "Front camera"}
                    </span>
                    <Button onClick={switchCamera} size="sm" type="button" variant="outline">
                      <SwitchCamera className="mr-1.5 h-4 w-4" />
                      Switch camera
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" onClick={closeCameraModal} type="button" variant="outline">
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={Boolean(cameraError) || cameraLoading || !cameraStream || capturingPhoto}
                onClick={() => void handleCaptureFromCamera()}
                type="button"
              >
                {capturingPhoto ? "Capturing…" : "Capture photo"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

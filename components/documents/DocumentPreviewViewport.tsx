"use client";

import { Download, ExternalLink, File, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isImageMime, isPdfMime } from "@/lib/document-preview";

type DocumentPreviewViewportProps = {
  fileName: string;
  mime: string;
  loading: boolean;
  pdfPreviewUrl: string | null;
  blobPreviewUrl: string | null;
  imageZoom?: number;
  imageRotation?: number;
  onDownload?: () => void;
  onOpenInNewTab?: () => void;
};

export function DocumentPreviewViewport({
  fileName,
  mime,
  loading,
  pdfPreviewUrl,
  blobPreviewUrl,
  imageZoom = 1,
  imageRotation = 0,
  onDownload,
  onOpenInNewTab,
}: DocumentPreviewViewportProps) {
  const isPdf = isPdfMime(mime, fileName);
  const isImage = isImageMime(mime);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border-4 border-muted" />
          <Loader2 className="absolute h-16 w-16 animate-spin text-primary" />
          <FileText className="absolute h-6 w-6 text-muted-foreground/30" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">Loading preview…</p>
          <p className="text-xs font-medium text-muted-foreground/80 mt-1">
            Fetching document from the server.
          </p>
        </div>
      </div>
    );
  }

  if (!pdfPreviewUrl && !blobPreviewUrl) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <File className="h-14 w-14 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground font-semibold">Unable to load preview</p>
      </div>
    );
  }

  if (isPdf) {
    const iframeSrc = pdfPreviewUrl
      ? `${pdfPreviewUrl}#view=FitH`
      : blobPreviewUrl
        ? `${blobPreviewUrl}#view=FitH`
        : null;

    if (iframeSrc) {
      return (
        <iframe
          src={iframeSrc}
          className="absolute inset-0 h-full w-full min-h-[480px] border-0 bg-white"
          title={`Preview: ${fileName}`}
        />
      );
    }
  }

  if (isImage && blobPreviewUrl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center overflow-auto p-6 bg-grid-black/[0.02] dark:bg-grid-white/[0.02]">
        <img
          src={blobPreviewUrl}
          alt={fileName}
          className="max-w-full transition-transform duration-200 rounded-xl shadow-2xl ring-1 ring-border/50"
          style={{
            transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
            transformOrigin: "center center",
          }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
      <div className="p-6 bg-background rounded-full border border-border shadow-sm">
        <File className="h-16 w-16 text-muted-foreground/30" />
      </div>
      <div className="text-center max-w-sm px-4">
        <p className="text-base font-bold text-foreground">Preview not available</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          This file type ({mime || "unknown"}) cannot be shown in the browser. Please download
          the file to open it on your device.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onDownload ? (
          <Button onClick={onDownload} className="gap-2 shadow-md">
            <Download className="h-4 w-4" />
            Download file
          </Button>
        ) : null}
        {onOpenInNewTab && (pdfPreviewUrl || blobPreviewUrl) ? (
          <Button onClick={onOpenInNewTab} variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </Button>
        ) : null}
      </div>
    </div>
  );
}

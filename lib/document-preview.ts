export function getMimeFromName(name: string): string {
  const lower = (name || "").toLowerCase();
  if (/\.pdf$/i.test(lower)) return "application/pdf";
  if (/\.png$/i.test(lower)) return "image/png";
  if (/\.jpe?g$/i.test(lower)) return "image/jpeg";
  if (/\.gif$/i.test(lower)) return "image/gif";
  if (/\.webp$/i.test(lower)) return "image/webp";
  if (/\.svg$/i.test(lower)) return "image/svg+xml";
  if (/\.bmp$/i.test(lower)) return "image/bmp";
  return "application/octet-stream";
}

/** PDF and common image types that can render in-browser. */
export function isPreviewable(name: string): boolean {
  return /\.(pdf|png|jpe?g|gif|webp|svg|bmp)$/i.test(name || "");
}

export function isPdfMime(mime: string, fileName?: string): boolean {
  if (mime.toLowerCase().includes("pdf")) return true;
  return /\.pdf$/i.test(fileName || "");
}

export function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}

export function toPreviewBlob(blob: Blob, fileName: string): Blob {
  const guessed = getMimeFromName(fileName);
  const type =
    blob.type && blob.type !== "application/octet-stream" ? blob.type : guessed;
  if (isPdfMime(type, fileName)) {
    return new Blob([blob], { type: "application/pdf" });
  }
  if (blob.type === type) return blob;
  return new Blob([blob], { type });
}

/** Same-origin URL for inline PDF preview (iframe/embed) with auth via cookie. */
export function buildEmployeeDocumentPreviewUrl(
  employeeId: number,
  documentId: number,
): string {
  const params = new URLSearchParams({
    employeeId: String(employeeId),
    docId: String(documentId),
  });
  return `/api/employee-document-preview?${params.toString()}`;
}

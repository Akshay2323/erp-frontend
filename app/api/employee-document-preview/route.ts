import { NextRequest, NextResponse } from "next/server";

import { serverFetch } from "@/lib/api/server-fetch";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cache-constants";
import { serverApiUrl } from "@/lib/config";

export async function GET(request: NextRequest) {
  const employeeId = request.nextUrl.searchParams.get("employeeId");
  const docId = request.nextUrl.searchParams.get("docId");
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;

  if (!employeeId || !docId || !token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Backend route: GET /api/v1/employees/{employee}/documents/{document}/preview
  // Works for Admin (HR / Company Admin / Group Admin) and Employee (own docs).
  const target = serverApiUrl(
    `v1/employees/${employeeId}/documents/${docId}/preview`,
  );

  try {
    const upstream = await serverFetch(target, {
      method: "GET",
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
      redirect: "manual",
    });

    // Follow a same-host https upgrade ourselves so Authorization is kept.
    let response = upstream;
    const location = upstream.headers.get("location");
    if (
      (upstream.status === 301 || upstream.status === 302 || upstream.status === 307 || upstream.status === 308) &&
      location
    ) {
      const redirected = new URL(location, target);
      response = await serverFetch(redirected.toString(), {
        method: "GET",
        headers: {
          Accept: "*/*",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
        cache: "no-store",
        redirect: "manual",
      });
    }

    if (!response.ok) {
      let message = "Unable to load document preview.";
      try {
        const body = (await response.clone().json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // non-JSON error body — keep default message
      }
      return NextResponse.json({ message }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "";
    const resolvedType = contentType.toLowerCase().includes("pdf")
      ? "application/pdf"
      : contentType || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", resolvedType);
    headers.set("Content-Disposition", "inline");
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Cache-Control", "private, no-store");

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Document preview proxy failed:", error);
    return NextResponse.json(
      { message: "Unable to reach document server." },
      { status: 502 },
    );
  }
}

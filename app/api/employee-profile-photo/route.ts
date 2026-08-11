import { NextRequest, NextResponse } from "next/server";

import { serverFetch } from "@/lib/api/server-fetch";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cache-constants";
import { serverApiUrl } from "@/lib/config";

export async function GET(request: NextRequest) {
  const employeeId = request.nextUrl.searchParams.get("employeeId");
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;

  if (!employeeId || !token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const target = serverApiUrl(`v1/employees/${employeeId}/profile-photo`);

  try {
    const upstream = await serverFetch(target, {
      method: "GET",
      headers: {
        Accept: "image/*",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
      redirect: "manual",
    });

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
          Accept: "image/*",
          Authorization: `Bearer ${token}`,
          "X-CSRF-TOKEN": "",
        },
        cache: "no-store",
        redirect: "manual",
      });
    }

    if (!response.ok) {
      let message = "Unable to load profile photo.";
      try {
        const body = (await response.clone().json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // non-JSON error body
      }
      return NextResponse.json({ message }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Profile photo proxy failed:", error);
    return NextResponse.json(
      { message: "Unable to reach profile photo server." },
      { status: 502 },
    );
  }
}

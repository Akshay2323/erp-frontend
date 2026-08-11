import { NextRequest, NextResponse } from "next/server";

import { serverFetch } from "@/lib/api/server-fetch";
import { SERVER_API_BASE_URL } from "@/lib/config";

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "x-csrf-token",
] as const;

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyToBackend(request: NextRequest, pathSegments: string[]) {
  const target = new URL(pathSegments.join("/"), SERVER_API_BASE_URL);

  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await serverFetch(target.toString(), init);
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`API proxy failed [${target}]:`, error);
    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to reach API server. Check API_BASE_URL and TLS settings.",
      },
      { status: 502 },
    );
  }
}

async function handle(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

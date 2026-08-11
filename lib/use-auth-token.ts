"use client";

import Cookies from "js-cookie";
import { useSyncExternalStore } from "react";

function readToken(): string {
  return Cookies.get("auth_token") ?? "";
}

/** Reads auth token on the first client render — avoids a blank `useEffect` cycle. */
export function useAuthToken(): string {
  return useSyncExternalStore(() => () => {}, readToken, () => "");
}

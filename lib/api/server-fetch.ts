/**
 * Server-side fetch for calls to the HRMS API.
 * Windows servers may fail TLS verification (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
 * when the API certificate chain is incomplete.
 * Set API_TLS_REJECT_UNAUTHORIZED=false in env for trusted internal networks only.
 */
if (process.env.API_TLS_REJECT_UNAUTHORIZED === "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function serverFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}

/** True only on first fetch (no cached data yet). */
export function isInitialQueryLoad(query: {
  isLoading: boolean;
  data: unknown;
}): boolean {
  return query.isLoading && query.data === undefined;
}

/** True when refetching but stale/cached data is already on screen. */
export function isQueryRefreshing(query: {
  isFetching: boolean;
  isLoading: boolean;
  data: unknown;
}): boolean {
  return query.isFetching && !query.isLoading && query.data !== undefined;
}

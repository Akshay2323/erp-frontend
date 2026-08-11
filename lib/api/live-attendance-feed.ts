import { API_BASE_URL } from "@/lib/config";

export type LiveAttendanceFeedItem = {
  id: number;
  attendance_id?: number;
  employee: {
    id?: number;
    name: string;
    employee_code: string;
    department?: string | null;
    profile_photo_url?: string | null;
  };
  action: string;
  punch_type: "punch_in" | "punch_out";
  punch_time?: string | null;
  punch_time_formatted?: string | null;
  punch_time_human?: string | null;
  selfie_url?: string | null;
  location: {
    address?: string | null;
    live_address?: string | null;
    punch_address?: string | null;
    branch_name?: string | null;
    branch_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    google_maps_url?: string | null;
  };
  device: {
    info?: string | null;
    ip_address?: string | null;
  };
  geofence: {
    within_radius?: boolean | null;
    status?: string;
    status_label?: string;
    distance_meters?: number | null;
  };
  remarks?: string | null;
  company?: { id?: number; name?: string | null };
};

export type LiveAttendanceFeedStats = {
  total_live_actions: number;
  punched_in: number;
  punched_out: number;
  geofence_compliance_percent: number;
};

type FeedEnvelope<T> = {
  success?: boolean;
  status?: boolean;
  message?: string;
  data: T;
};

export type LiveAttendanceFeedListData = {
  items: LiveAttendanceFeedItem[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
};

export type LiveAttendanceFeedPollData = {
  items: LiveAttendanceFeedItem[];
  since_id: number;
  last_id: number;
};

export class LiveAttendanceFeedError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LiveAttendanceFeedError";
    this.status = status;
  }
}

async function parseFeedJson<T>(response: Response): Promise<FeedEnvelope<T>> {
  const result = (await response.json()) as FeedEnvelope<T>;
  const ok = result.success === true || result.status === true;
  if (!response.ok || !ok) {
    throw new LiveAttendanceFeedError(
      result.message || "Unable to load live attendance feed.",
      response.status,
    );
  }
  return result;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchLiveAttendanceFeed(
  token: string,
  params: {
    date: string;
    search?: string;
    punch_type?: "punch_in" | "punch_out";
    within_radius?: boolean;
    page?: number;
    per_page?: number;
  },
): Promise<LiveAttendanceFeedListData> {
  const response = await fetch(
    `${API_BASE_URL}v1/admin/attendance/live-feed${buildQuery({
      date: params.date,
      search: params.search,
      punch_type: params.punch_type,
      within_radius:
        params.within_radius === undefined ? undefined : params.within_radius ? "1" : "0",
      page: params.page ?? 1,
      per_page: params.per_page ?? 100,
    })}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const result = await parseFeedJson<LiveAttendanceFeedListData>(response);
  return result.data;
}

/** Fetch all pages (API max per_page is 100). */
export async function fetchLiveAttendanceFeedAll(
  token: string,
  params: Omit<Parameters<typeof fetchLiveAttendanceFeed>[1], "page" | "per_page">,
): Promise<LiveAttendanceFeedListData> {
  const allItems: LiveAttendanceFeedListData["items"] = [];
  let page = 1;
  let lastPage = 1;
  let meta: LiveAttendanceFeedListData | null = null;

  do {
    const batch = await fetchLiveAttendanceFeed(token, { ...params, page, per_page: 100 });
    meta = batch;
    allItems.push(...batch.items);
    lastPage = batch.last_page ?? 1;
    page += 1;
  } while (page <= lastPage && page <= 50);

  return {
    items: allItems,
    total: meta?.total ?? allItems.length,
    current_page: 1,
    last_page: 1,
    per_page: allItems.length,
  };
}

export async function fetchLiveAttendanceFeedStats(
  token: string,
  date: string,
): Promise<LiveAttendanceFeedStats> {
  const response = await fetch(
    `${API_BASE_URL}v1/admin/attendance/live-feed/stats${buildQuery({ date })}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const result = await parseFeedJson<LiveAttendanceFeedStats>(response);
  return result.data;
}

export async function pollLiveAttendanceFeed(
  token: string,
  params: { date: string; since_id: number },
): Promise<LiveAttendanceFeedPollData> {
  const response = await fetch(
    `${API_BASE_URL}v1/admin/attendance/live-feed/poll${buildQuery({
      date: params.date,
      since_id: params.since_id,
    })}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const result = await parseFeedJson<LiveAttendanceFeedPollData>(response);
  return result.data;
}

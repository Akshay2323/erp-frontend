import { API_BASE_URL } from "@/lib/config";

export type AnnouncementStatus = "published" | "draft";
export type AnnouncementAudience = "company" | "all";

export type Announcement = {
  id: number;
  company_id: number;
  title: string;
  content: string;
  audience_scope: AnnouncementAudience;
  status: AnnouncementStatus;
  published_at: string;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
};

export type AnnouncementListResponse = {
  success: boolean;
  message: string;
  data: Announcement[] | { items: Announcement[] };
};

export type CreateAnnouncementPayload = {
  company_id: number;
  title: string;
  content: string;
  audience_scope: AnnouncementAudience;
  status: AnnouncementStatus;
  published_at: string;
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

export async function getAnnouncements(token: string): Promise<Announcement[]> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/employee-operations/announcements`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = await parseResponse<AnnouncementListResponse>(response);
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Failed to fetch announcements.");
    }
    const raw = payload.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && "items" in raw && Array.isArray(raw.items)) {
      return raw.items;
    }
    return [];
  } catch (error) {
    console.error("getAnnouncements error:", error);
    throw error;
  }
}

export async function createAnnouncement(
  token: string,
  payload: CreateAnnouncementPayload
): Promise<{ success: boolean; data?: Announcement; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/employee-operations/announcements`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await parseResponse<{ success: boolean; data?: Announcement; message: string }>(
      response
    );
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to create announcement.");
    }
    return result;
  } catch (error) {
    console.error("createAnnouncement error:", error);
    throw error;
  }
}

export async function readAnnouncement(token: string, announcementId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}v1/employee-operations/announcements/${announcementId}/read`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "",
      }
    );

    const result = await parseResponse<{ success: boolean; message?: string }>(response);
    return response.ok && result.success;
  } catch (error) {
    console.error("readAnnouncement error:", error);
    return false;
  }
}

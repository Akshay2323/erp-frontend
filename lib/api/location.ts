import { API_BASE_URL } from "@/lib/config";

export type GeoLocation = {
  id?: string | number;
  company_id?: number;
  branch_id?: number;
  company?: { id: number; company_name?: string; name?: string };
  branch?: { id: number; name: string };
  code: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  active: boolean;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type LocationMutationResponse = ApiEnvelope<{ geolocation?: GeoLocation }>;

export type LocationApiError = {
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const parseResponse = async <T>(response: Response): Promise<T> =>
  (await response.json()) as T;

const isLocationApiError = (error: unknown): error is LocationApiError =>
  typeof error === "object" && error !== null && "message" in error;

const fail = (message: string, fieldErrors?: Record<string, string[]>) =>
  Promise.reject({ message, fieldErrors } as LocationApiError);

export async function createLocation(
  token: string,
  payload: GeoLocation,
): Promise<LocationMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/geolocations`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const result = await parseResponse<
      LocationMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>
    >(response);
    
    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to create location.", fieldErrors);
    }
    return result as LocationMutationResponse;
  } catch (error) {
    if (isLocationApiError(error)) return Promise.reject(error);
    return fail("Unable to create location.");
  }
}

export type LocationListResponse = ApiEnvelope<GeoLocation[]>;

const normalizeLocationList = (data: unknown): GeoLocation[] => {
  if (Array.isArray(data)) return data as GeoLocation[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "geolocations", "locations", "data"] as const) {
      if (Array.isArray(obj[key])) return obj[key] as GeoLocation[];
    }
  }
  return [];
};

export async function getLocations(token: string): Promise<LocationListResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/geolocations`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const payload = await parseResponse<ApiEnvelope<unknown>>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch locations.");
    }
    return {
      ...payload,
      data: normalizeLocationList(payload.data),
    };
  } catch (error) {
    if (isLocationApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch locations.");
  }
}

export async function getLocation(
  token: string,
  id: string | number,
): Promise<ApiEnvelope<{ geolocation: GeoLocation }>> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/geolocations/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-TOKEN": "",
      },
      cache: "no-store",
    });

    const payload = await parseResponse<ApiEnvelope<{ geolocation: GeoLocation }>>(response);
    if (!response.ok || !payload.success) {
      return fail(payload.message || "Unable to fetch location details.");
    }
    return payload;
  } catch (error) {
    if (isLocationApiError(error)) return Promise.reject(error);
    return fail("Unable to fetch location details.");
  }
}

export async function updateLocation(
  token: string,
  id: string | number,
  payload: GeoLocation,
): Promise<LocationMutationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}v1/organization/geolocations/${id}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": "",
      },
      body: JSON.stringify(payload),
    });

    const result = await parseResponse<
      LocationMutationResponse | ApiEnvelope<{ errors?: Record<string, string[]> }>
    >(response);

    if (!response.ok || !result.success) {
      const fieldErrors =
        typeof result.data === "object" && result.data && "errors" in result.data
          ? (result.data.errors as Record<string, string[]> | undefined)
          : undefined;
      return fail(result.message || "Unable to update location.", fieldErrors);
    }
    return result as LocationMutationResponse;
  } catch (error) {
    if (isLocationApiError(error)) return Promise.reject(error);
    return fail("Unable to update location.");
  }
}

export type GeocodeResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    county?: string;
  };
};

/** Search places within India using OpenStreetMap Nominatim. */
export async function searchLocationsInIndia(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    format: "json",
    q: trimmed,
    limit: String(limit),
    countrycodes: "in",
    addressdetails: "1",
    "accept-language": "en",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { "Accept-Language": "en" } },
  );

  if (!response.ok) {
    throw new Error("Location search failed. Please try again.");
  }

  const data = (await response.json()) as GeocodeResult[];
  return Array.isArray(data) ? data : [];
}

export function parseIndiaAddress(result: GeocodeResult) {
  const addr = result.address ?? {};
  const street = [addr.road, addr.suburb, addr.neighbourhood].filter(Boolean).join(", ");
  const city = addr.city || addr.town || addr.village || addr.county || "";
  const state = addr.state || "";
  const pincode = addr.postcode || "";

  return {
    address: street || result.display_name.split(",")[0]?.trim() || "",
    city,
    state,
    pincode,
  };
}

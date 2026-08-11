const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinAllocatedGeolocation(
  userLat: number,
  userLng: number,
  geo: { lat: number; lng: number; radius: number },
): { within: boolean; distanceMeters: number } {
  const distance = distanceMeters(userLat, userLng, geo.lat, geo.lng);
  const radius = Math.max(0, Number(geo.radius) || 0);
  return { within: distance <= radius, distanceMeters: distance };
}

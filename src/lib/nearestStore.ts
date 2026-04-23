// Coordinates for each store (verified via Nominatim with postal code)
const STORE_COORDS: Record<string, { lat: number; lng: number }> = {
  tarragona:   { lat: 41.1155485, lng: 1.2485137 }, // Carrer Reding 32 Bajos, 43001 Tarragona
  arrabassada: { lat: 41.1218510, lng: 1.2687617 }, // Carrer Joan Fuster 28, 43007 Tarragona (Vall de l'Arrabassada)
};

// Haversine distance in km between two lat/lng points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode an address string using OpenStreetMap Nominatim (free, no API key)
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=es`;
  try {
    const res = await fetch(url, {
      headers: { "Accept-Language": "es", "User-Agent": "lozio-table-booker/1.0" },
    });
    if (!res.ok) {
      console.warn("[nearestStore] Nominatim returned", res.status);
      return null;
    }
    const data = await res.json();
    console.log("[nearestStore] Geocode result for:", address, "→", data[0] ?? "no results");
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e) {
    console.warn("[nearestStore] Geocode failed:", e);
    return null;
  }
}

// Strip apartment/floor info (e.g. "Calle X 3, 2-2" → "Calle X 3")
function stripApartment(address: string): string {
  // Keep only the first part before a comma (street + number)
  return address.split(",")[0].trim();
}

/**
 * Given a delivery address and the time the order should be fulfilled,
 * returns the nearest OPEN store slug.
 * Falls back to the nearest store regardless of hours if both are closed.
 */
export async function getNearestStore(
  address: string,
  city: string,
  postalCode: string,
  at: Date = new Date()
): Promise<"tarragona" | "arrabassada"> {
  const { isStoreOpen } = await import("@/lib/storeHours");

  const street = stripApartment(address);
  const attempts = [
    [street, postalCode, "Tarragona", "España"].filter(Boolean).join(", "),
    [street, "Tarragona", "España"].filter(Boolean).join(", "),
    [postalCode, "Tarragona", "España"].filter(Boolean).join(", "),
  ];

  let coords: { lat: number; lng: number } | null = null;
  for (const attempt of attempts) {
    console.log("[nearestStore] Trying:", attempt);
    coords = await geocode(attempt);
    if (coords) break;
  }

  const candidates = (["tarragona", "arrabassada"] as const)
    .filter((s) => isStoreOpen(s, at));

  // If no store is open at the given time, use all stores as candidates
  const pool = candidates.length > 0 ? candidates : (["tarragona", "arrabassada"] as const);

  if (!coords) {
    console.warn("[nearestStore] Geocoding failed, using first open store:", pool[0]);
    return pool[0];
  }

  const distances = pool.map((slug) => ({
    slug,
    km: haversine(coords!.lat, coords!.lng, STORE_COORDS[slug].lat, STORE_COORDS[slug].lng),
  }));

  distances.sort((a, b) => a.km - b.km);
  console.log("[nearestStore] Distances:", distances.map((d) => `${d.slug}: ${d.km.toFixed(2)}km`).join(", "));
  console.log("[nearestStore] Assigned to:", distances[0].slug);

  return distances[0].slug;
}

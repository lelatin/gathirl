/* =====================================================================
   Géographie : recherche d'adresses (Photon / OpenStreetMap, gratuit,
   sans clé) et distance à vol d'oiseau.
   ===================================================================== */

const PHOTON = "https://photon.komoot.io/api/";

/**
 * Recherche de lieux.
 * @param {string} q        texte saisi
 * @param {boolean} cityOnly  ne renvoyer que des villes
 */
export async function searchPlaces(q, cityOnly = false, signal) {
  if (!q || q.trim().length < 2) return [];
  // Biais géographique vers la France (les résultats proches remontent en premier)
  const params = new URLSearchParams({ q: q.trim(), lang: "fr", limit: "8", lat: "46.6", lon: "2.4", location_bias_scale: "0.3" });
  if (cityOnly) params.append("layer", "city");
  const res = await fetch(`${PHOTON}?${params}`, { signal });
  if (!res.ok) throw new Error("Recherche indisponible");
  const data = await res.json();
  const seen = new Set();
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates || [];
    const name = p.name || p.street || p.city || "Lieu";
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    return {
      name,
      city: p.city || (p.type === "city" ? p.name : "") || p.name || "",
      sub: [street && street !== name ? street : "", p.postcode, p.city && p.city !== name ? p.city : "", p.state, p.country].filter(Boolean).join(", "),
      address: [p.name, street, p.postcode, p.city, p.country].filter(Boolean).join(", "),
      lat, lng,
    };
  }).filter((r) => {
    const k = r.name + "|" + r.sub;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);
}

/** Distance en km (formule de haversine) */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const osmLink = (lat, lng) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

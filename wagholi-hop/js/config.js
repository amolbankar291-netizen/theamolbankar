/** Production config — Mapbox token + provider */

export const TOKEN_KEY = "wagholihop.mapboxToken";
export const PROVIDER_KEY = "wagholihop.mapProvider";

/** Wagholi service center (approx). */
export const WAGHOLI_CENTER = { lat: 18.581, lng: 73.983 };
export const SERVICE_RADIUS_KM = 2.5;

export function getMapProvider() {
  return localStorage.getItem(PROVIDER_KEY) || "mapbox";
}

export function setMapProvider(provider) {
  localStorage.setItem(PROVIDER_KEY, provider);
}

export function getMapboxToken() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("mapbox");
  if (fromQuery) {
    localStorage.setItem(TOKEN_KEY, fromQuery);
    return fromQuery.trim();
  }
  if (typeof window !== "undefined" && window.WAGHOLIHOP_MAPBOX_TOKEN) {
    return String(window.WAGHOLIHOP_MAPBOX_TOKEN).trim();
  }
  return (localStorage.getItem(TOKEN_KEY) || "").trim();
}

export function setMapboxToken(token) {
  const t = (token || "").trim();
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  return t;
}

export function hasMapbox() {
  return Boolean(getMapboxToken() && window.mapboxgl);
}

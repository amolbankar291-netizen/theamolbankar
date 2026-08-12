/** Browser GPS helpers */

import { WAGHOLI_CENTER } from "./config.js";

const R_KM = 6371;

export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: Date.now(),
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 4000,
        ...options,
      }
    );
  });
}

export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.(new Error("GPS not supported"));
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        at: Date.now(),
      });
    },
    (err) => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
  );
}

export function clearWatch(id) {
  if (id != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(id);
  }
}

export function nearestPoint(origin, points) {
  let best = null;
  let bestKm = Infinity;
  for (const p of points) {
    const km = haversineKm(origin, p);
    if (km < bestKm) {
      bestKm = km;
      best = { ...p, km };
    }
  }
  return best;
}

/** Simple along-line point for GeoJSON LineString coordinates [lng,lat][] */
export function pointAlongLine(coordinates, t) {
  if (!coordinates?.length) return null;
  if (t <= 0) {
    const [lng, lat] = coordinates[0];
    return { lat, lng };
  }
  if (t >= 1) {
    const [lng, lat] = coordinates[coordinates.length - 1];
    return { lat, lng };
  }

  let total = 0;
  const segs = [];
  for (let i = 1; i < coordinates.length; i++) {
    const a = { lat: coordinates[i - 1][1], lng: coordinates[i - 1][0] };
    const b = { lat: coordinates[i][1], lng: coordinates[i][0] };
    const d = haversineKm(a, b);
    segs.push({ a, b, d });
    total += d;
  }
  if (total <= 0) {
    const [lng, lat] = coordinates[0];
    return { lat, lng };
  }

  let target = total * t;
  for (const seg of segs) {
    if (target <= seg.d) {
      const u = seg.d === 0 ? 0 : target / seg.d;
      return {
        lat: seg.a.lat + (seg.b.lat - seg.a.lat) * u,
        lng: seg.a.lng + (seg.b.lng - seg.a.lng) * u,
      };
    }
    target -= seg.d;
  }
  const last = coordinates[coordinates.length - 1];
  return { lat: last[1], lng: last[0] };
}

export function isNearWagholi(pos, radiusKm = 8) {
  return haversineKm(pos, WAGHOLI_CENTER) <= radiusKm;
}

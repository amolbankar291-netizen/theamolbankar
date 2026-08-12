/** Safety pack: live track, share links, SOS + GPS-aware positions */

import { HUBS, placeById, hubById } from "./data.js";
import { pointAlongLine } from "./geo.js";

export const LIVE_KEY = "wagholihop.live.v1";
export const EMERGENCY_INDIA = "112";

/** Percent coords fallback for demo SVG map. */
export const PLACE_COORDS = {
  "society-gate": { x: 30, y: 40 },
  "dnyanada-school": { x: 60, y: 26 },
  "wagholi-clinic": { x: 68, y: 36 },
  "kirana-lane": { x: 36, y: 48 },
  "sabji-market": { x: 42, y: 74 },
  "nagar-road-feeder": { x: 78, y: 62 },
  "bakori-phata": { x: 50, y: 58 },
};

export function coordsForHub(hubId) {
  const h = hubById(hubId);
  if (!h) return { x: 40, y: 50, lat: 18.581, lng: 73.983 };
  return { x: h.x, y: h.y, lat: h.lat, lng: h.lng };
}

export function coordsForPlace(placeId) {
  const p = placeById(placeId);
  if (p) return { x: p.x, y: p.y, lat: p.lat, lng: p.lng };
  const fallback = PLACE_COORDS[placeId] ?? { x: 55, y: 45 };
  return { ...fallback, lat: 18.581, lng: 73.983 };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function pointAlong(from, to, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const mid = {
    x: (from.x + to.x) / 2 + (to.y - from.y) * 0.08,
    y: (from.y + to.y) / 2 - (to.x - from.x) * 0.08,
  };
  if (clamped < 0.5) {
    const u = clamped / 0.5;
    return { x: lerp(from.x, mid.x, u), y: lerp(from.y, mid.y, u) };
  }
  const u = (clamped - 0.5) / 0.5;
  return { x: lerp(mid.x, to.x, u), y: lerp(mid.y, to.y, u) };
}

export function rideProgress(ride, now = Date.now()) {
  if (!ride) return 0;
  if (ride.status === "searching") return 0;
  if (ride.status === "arrived") return 0;
  if (ride.status === "completed") return 1;

  if (ride.status === "driver_assigned") {
    const start = ride.assignedAt ?? ride.createdAt;
    const span = Math.max(20_000, (ride.etaMins || 5) * 12_000);
    return Math.min(0.95, (now - start) / span);
  }

  if (ride.status === "on_trip") {
    const start = ride.tripStartedAt ?? now;
    const span = Math.max(45_000, (ride.km || 1.5) * 40_000);
    return Math.min(0.99, (now - start) / span);
  }

  return 0;
}

/** Percent position for SVG fallback map */
export function vehiclePosition(ride, now = Date.now()) {
  const pickup = ride.pickupCoords ?? coordsForHub(ride.hubId);
  const drop = ride.dropCoords ?? { x: 60, y: 30 };
  const t = rideProgress(ride, now);

  if (ride.status === "driver_assigned") {
    const approachFrom = {
      x: Math.max(8, pickup.x - 14),
      y: Math.max(8, pickup.y + 10),
    };
    return pointAlong(approachFrom, pickup, t);
  }

  if (ride.status === "arrived") return { x: pickup.x, y: pickup.y };
  if (ride.status === "on_trip" || ride.status === "completed") {
    return pointAlong(pickup, drop, t);
  }

  return { x: pickup.x, y: pickup.y };
}

/** Real lat/lng for Mapbox live tracking */
export function vehicleLatLng(ride, now = Date.now()) {
  if (ride?.vehicleGps?.lat != null) {
    return { lat: ride.vehicleGps.lat, lng: ride.vehicleGps.lng, source: "gps" };
  }

  const pickup = {
    lat: ride.pickup?.lat ?? ride.pickupCoords?.lat,
    lng: ride.pickup?.lng ?? ride.pickupCoords?.lng,
  };
  const drop = {
    lat: ride.drop?.lat ?? ride.dropCoords?.lat,
    lng: ride.drop?.lng ?? ride.dropCoords?.lng,
  };
  const t = rideProgress(ride, now);
  const coords = ride.routeGeometry?.coordinates;

  if (ride.status === "arrived" && pickup.lat != null) {
    return { ...pickup, source: "pickup" };
  }

  if (coords?.length) {
    if (ride.status === "driver_assigned") {
      // approach first 15% of route reversed from pickup neighborhood
      const p = pointAlongLine(coords, Math.min(0.2, t * 0.2));
      return p ? { ...p, source: "route" } : null;
    }
    if (ride.status === "on_trip" || ride.status === "completed") {
      const p = pointAlongLine(coords, t);
      return p ? { ...p, source: "route" } : null;
    }
  }

  if (pickup.lat != null && drop.lat != null && ride.status === "on_trip") {
    return {
      lat: pickup.lat + (drop.lat - pickup.lat) * t,
      lng: pickup.lng + (drop.lng - pickup.lng) * t,
      source: "lerp",
    };
  }

  if (pickup.lat != null) return { ...pickup, source: "pickup" };
  return null;
}

export function buildLiveSnapshot(ride, emergencyContact) {
  if (!ride) return null;
  const pos = vehiclePosition(ride);
  const gps = vehicleLatLng(ride);
  return {
    id: ride.id,
    from: ride.from,
    to: ride.to,
    driverName: ride.driverName,
    vehicle: ride.vehicle,
    status: ride.status,
    fare: ride.fare,
    otpHidden: true,
    etaMins: ride.etaMins,
    km: ride.km,
    sos: !!ride.sos,
    sosAt: ride.sosAt ?? null,
    pickupCoords: ride.pickupCoords,
    dropCoords: ride.dropCoords,
    pickup: ride.pickup,
    drop: ride.drop,
    routeGeometry: ride.routeGeometry || null,
    assignedAt: ride.assignedAt,
    tripStartedAt: ride.tripStartedAt,
    createdAt: ride.createdAt,
    hubId: ride.hubId,
    placeId: ride.placeId,
    vehicleX: pos.x,
    vehicleY: pos.y,
    vehicleLat: gps?.lat ?? null,
    vehicleLng: gps?.lng ?? null,
    vehicleGps: ride.vehicleGps || null,
    etaProvider: ride.etaProvider || "estimate",
    progress: rideProgress(ride),
    emergencyName: emergencyContact?.name || "",
    updatedAt: Date.now(),
  };
}

export function publishLive(snapshot) {
  if (!snapshot) {
    localStorage.removeItem(LIVE_KEY);
    return;
  }
  localStorage.setItem(LIVE_KEY, JSON.stringify(snapshot));
}

export function readLive() {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function encodeSharePayload(snapshot) {
  // Keep share URL smaller: drop heavy geometry if huge
  const slim = { ...snapshot };
  if (slim.routeGeometry?.coordinates?.length > 80) {
    const c = slim.routeGeometry.coordinates;
    const step = Math.ceil(c.length / 60);
    slim.routeGeometry = {
      type: "LineString",
      coordinates: c.filter((_, i) => i % step === 0 || i === c.length - 1),
    };
  }
  const json = JSON.stringify(slim);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSharePayload(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function liveTrackUrl(snapshot) {
  const base = new URL("track.html", window.location.href).href;
  return `${base}#${encodeSharePayload(snapshot)}`;
}

export function shareText(ride, url) {
  const sos = ride.sos ? " 🚨 SOS ACTIVE" : "";
  return (
    `WagholiHop live track${sos}\n` +
    `${ride.from} → ${ride.to}\n` +
    `Driver: ${ride.driverName || "assigning…"}\n` +
    `Vehicle: ${ride.vehicle || "—"}\n` +
    `Watch live: ${url}`
  );
}

export function renderTrackMap(container, rideLike, opts = {}) {
  if (!container) return;
  // If Mapbox already owns this container, skip SVG overwrite
  if (container.dataset.mapbox === "1") return;

  const pickup = rideLike.pickupCoords ?? coordsForHub(rideLike.hubId);
  const drop = rideLike.dropCoords ?? { x: 60, y: 30 };
  const pos =
    rideLike.vehicleX != null
      ? { x: rideLike.vehicleX, y: rideLike.vehicleY }
      : vehiclePosition(rideLike);

  const sosClass = rideLike.sos ? " sos-active" : "";
  container.innerHTML = `
    <svg class="track-svg${sosClass}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="road" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1f6f9a"/>
          <stop offset="100%" stop-color="#12263a"/>
        </linearGradient>
      </defs>
      <path d="M ${pickup.x} ${pickup.y} Q ${(pickup.x + drop.x) / 2 + 4} ${(pickup.y + drop.y) / 2 - 6} ${drop.x} ${drop.y}"
        fill="none" stroke="url(#road)" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
    </svg>
    <div class="map-pin pickup" style="left:${pickup.x}%;top:${pickup.y}%">P</div>
    <div class="map-pin drop" style="left:${drop.x}%;top:${drop.y}%">D</div>
    <div class="map-vehicle${rideLike.sos ? " sos" : ""}" style="left:${pos.x}%;top:${pos.y}%">
      <span>${opts.label || "🚗"}</span>
    </div>
  `;
}

export function statusSafetyLabel(status) {
  return (
    {
      searching: "Matching a verified hub driver…",
      driver_assigned: "Live track on — driver en route to you",
      arrived: "Driver at pickup — verify vehicle & OTP",
      on_trip: "Live GPS tracking active for your safety",
      completed: "Trip ended safely",
      cancelled: "Trip cancelled",
    }[status] || status
  );
}

export { HUBS, placeById };

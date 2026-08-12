/** Mapbox GL map + Directions ETA (production step 1) */

import { getMapboxToken, hasMapbox, WAGHOLI_CENTER } from "./config.js";

const ROUTE_SOURCE = "wh-route";
const ROUTE_LAYER = "wh-route-line";

export async function fetchDrivingRoute(from, to) {
  const token = getMapboxToken();
  if (!token) throw new Error("Mapbox token missing");

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directions failed (${res.status}): ${text.slice(0, 120)}`);
  }
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No driving route found");

  return {
    distanceKm: route.distance / 1000,
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    geometry: route.geometry, // GeoJSON LineString
    provider: "mapbox",
  };
}

export class HopMap {
  constructor(container, options = {}) {
    this.container = typeof container === "string" ? document.querySelector(container) : container;
    this.map = null;
    this.markers = {};
    this.options = options;
  }

  ready() {
    return hasMapbox() && !!this.container;
  }

  init(center = WAGHOLI_CENTER, zoom = 13.2) {
    if (!this.ready()) return null;
    if (this.map) return this.map;

    const token = getMapboxToken();
    mapboxgl.accessToken = token;

    this.container.classList.add("mapbox-ready");
    this.container.innerHTML = "";

    this.map = new mapboxgl.Map({
      container: this.container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom,
      attributionControl: true,
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    this.map.on("load", () => {
      if (!this.map.getSource(ROUTE_SOURCE)) {
        this.map.addSource(ROUTE_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        this.map.addLayer({
          id: ROUTE_LAYER,
          type: "line",
          source: ROUTE_SOURCE,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#12263a",
            "line-width": 5,
            "line-opacity": 0.9,
          },
        });
      }
    });

    return this.map;
  }

  _whenLoaded(fn) {
    if (!this.map) return;
    if (this.map.isStyleLoaded()) fn();
    else this.map.once("load", fn);
  }

  setMarker(key, lngLat, opts = {}) {
    if (!this.map || !lngLat) return;
    const el = document.createElement("div");
    el.className = `mbx-marker ${opts.className || ""}`;
    el.textContent = opts.label || "";

    if (this.markers[key]) this.markers[key].remove();
    this.markers[key] = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(this.map);
  }

  clearMarker(key) {
    this.markers[key]?.remove();
    delete this.markers[key];
  }

  setRoute(geometry) {
    this._whenLoaded(() => {
      const src = this.map.getSource(ROUTE_SOURCE);
      if (!src) return;
      if (!geometry) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      src.setData({
        type: "Feature",
        properties: {},
        geometry,
      });
    });
  }

  fitPoints(points, padding = 56) {
    if (!this.map || !points?.length) return;
    if (points.length === 1) {
      this.map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 14.2 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    points.forEach((p) => bounds.extend([p.lng, p.lat]));
    this.map.fitBounds(bounds, { padding, maxZoom: 15.5, duration: 600 });
  }

  resize() {
    this.map?.resize();
  }

  destroy() {
    Object.values(this.markers).forEach((m) => m.remove());
    this.markers = {};
    this.map?.remove();
    this.map = null;
  }
}

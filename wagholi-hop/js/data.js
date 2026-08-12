/** WagholiHop seed data — Wagholi, Pune (real lat/lng approx) */

export const HUBS = [
  {
    id: "park-street",
    name: "Park Street cluster",
    zone: "A",
    x: 28,
    y: 38,
    lat: 18.5788,
    lng: 73.9752,
    vehicles: 4,
    etaMins: 5,
  },
  {
    id: "bakori",
    name: "Bakori Road hub",
    zone: "A",
    x: 48,
    y: 55,
    lat: 18.5746,
    lng: 73.9884,
    vehicles: 3,
    etaMins: 6,
  },
  {
    id: "kesnand",
    name: "Kesnand junction",
    zone: "B",
    x: 72,
    y: 42,
    lat: 18.5912,
    lng: 74.0048,
    vehicles: 3,
    etaMins: 7,
  },
  {
    id: "school-belt",
    name: "School belt",
    zone: "B",
    x: 58,
    y: 28,
    lat: 18.5854,
    lng: 73.9786,
    vehicles: 2,
    etaMins: 5,
  },
  {
    id: "evening-market",
    name: "Evening market",
    zone: "C",
    x: 40,
    y: 72,
    lat: 18.5718,
    lng: 73.9824,
    vehicles: 3,
    etaMins: 8,
  },
];

export const PLACES = [
  {
    id: "society-gate",
    name: "My society gate",
    zone: "A",
    kind: "home",
    lat: 18.5796,
    lng: 73.9768,
    x: 30,
    y: 40,
  },
  {
    id: "dnyanada-school",
    name: "School (Dnyanada belt)",
    zone: "B",
    kind: "school",
    lat: 18.5862,
    lng: 73.9798,
    x: 60,
    y: 26,
  },
  {
    id: "wagholi-clinic",
    name: "Wagholi clinic cluster",
    zone: "B",
    kind: "clinic",
    lat: 18.5838,
    lng: 73.9912,
    x: 68,
    y: 36,
  },
  {
    id: "kirana-lane",
    name: "Kirana / daily needs",
    zone: "A",
    kind: "grocery",
    lat: 18.5772,
    lng: 73.9804,
    x: 36,
    y: 48,
  },
  {
    id: "sabji-market",
    name: "Evening sabji market",
    zone: "C",
    kind: "market",
    lat: 18.5712,
    lng: 73.9836,
    x: 42,
    y: 74,
  },
  {
    id: "nagar-road-feeder",
    name: "Nagar Road feeder junction",
    zone: "C",
    kind: "junction",
    lat: 18.5658,
    lng: 73.9698,
    x: 78,
    y: 62,
  },
  {
    id: "bakori-phata",
    name: "Bakori Phata",
    zone: "A",
    kind: "junction",
    lat: 18.5698,
    lng: 73.9906,
    x: 50,
    y: 58,
  },
];

/** Fixed fares by zone pair (₹). Max trip ~2.5 km. */
export const FARE_MATRIX = {
  "A-A": 30,
  "B-B": 30,
  "C-C": 30,
  "A-B": 45,
  "B-A": 45,
  "A-C": 55,
  "C-A": 55,
  "B-C": 50,
  "C-B": 50,
};

export const DISTANCE_KM = {
  "A-A": 0.9,
  "B-B": 1.0,
  "C-C": 1.1,
  "A-B": 1.6,
  "B-A": 1.6,
  "A-C": 2.1,
  "C-A": 2.1,
  "B-C": 1.8,
  "C-B": 1.8,
};

export const DRIVER_NAMES = [
  "Ramesh E",
  "Sanjay Auto",
  "Vikas ER",
  "Amit Wagholi",
  "Nitin Hub",
];

export function fareFor(fromZone, toZone) {
  return FARE_MATRIX[`${fromZone}-${toZone}`] ?? 70;
}

export function distanceFor(fromZone, toZone) {
  return DISTANCE_KM[`${fromZone}-${toZone}`] ?? 2.4;
}

export function hubById(id) {
  return HUBS.find((h) => h.id === id);
}

export function placeById(id) {
  return PLACES.find((p) => p.id === id);
}

export function hubLatLng(hub) {
  return { lat: hub.lat, lng: hub.lng };
}

export function placeLatLng(place) {
  return { lat: place.lat, lng: place.lng };
}

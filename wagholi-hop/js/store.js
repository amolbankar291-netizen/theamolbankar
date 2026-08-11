const KEY = "wagholihop.v1";

const defaultState = () => ({
  riderName: "You",
  history: [],
  activeRide: null,
  driver: {
    online: false,
    hubId: "park-street",
    earnings: 0,
    trips: 0,
    activeTripId: null,
  },
  queue: [], // pending requests visible to drivers
});

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function otp4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

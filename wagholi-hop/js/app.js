import {
  HUBS,
  PLACES,
  DRIVER_NAMES,
  fareFor,
  distanceFor,
  hubById,
  placeById,
  hubLatLng,
  placeLatLng,
} from "./data.js";
import { loadState, saveState, uid, otp4 } from "./store.js";
import {
  coordsForHub,
  coordsForPlace,
  buildLiveSnapshot,
  publishLive,
  liveTrackUrl,
  shareText,
  renderTrackMap,
  statusSafetyLabel,
  EMERGENCY_INDIA,
  vehiclePosition,
  vehicleLatLng,
} from "./safety.js";
import { getMapboxToken, setMapboxToken, hasMapbox, SERVICE_RADIUS_KM } from "./config.js";
import { getCurrentPosition, watchPosition, clearWatch, nearestPoint, isNearWagholi } from "./geo.js";
import { HopMap, fetchDrivingRoute } from "./maps.js";

const state = loadState();
let toastTimer;
let etaTimer;
let trackTimer;
let quoteSeq = 0;
let lastQuote = null;
let gpsPickup = null;
let bookingMap = null;
let rideMap = null;
let driverWatchId = null;

const $ = (sel) => document.querySelector(sel);

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function persist() {
  saveState(state);
  syncLivePublish();
}

function syncLivePublish() {
  const ride = state.activeRide;
  if (!ride || ["completed", "cancelled"].includes(ride.status)) {
    publishLive(null);
    return;
  }
  const pos = vehiclePosition(ride);
  ride.vehicleX = pos.x;
  ride.vehicleY = pos.y;
  const gps = vehicleLatLng(ride);
  if (gps) {
    ride.vehicleLat = gps.lat;
    ride.vehicleLng = gps.lng;
  }
  publishLive(buildLiveSnapshot(ride, state.emergencyContact));
}

function setMode(mode) {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${mode}`);
  });
  if (mode === "rider") {
    setTimeout(() => {
      bookingMap?.resize();
      rideMap?.resize();
    }, 80);
  }
}

function fillSelects() {
  const pickup = $("#pickup-hub");
  const drop = $("#drop-place");
  const driverHub = $("#driver-hub");

  pickup.innerHTML = HUBS.map(
    (h) => `<option value="${h.id}">${h.name} · Zone ${h.zone}</option>`
  ).join("");
  drop.innerHTML = PLACES.map(
    (p) => `<option value="${p.id}">${p.name} · Zone ${p.zone}</option>`
  ).join("");
  driverHub.innerHTML = HUBS.map(
    (h) => `<option value="${h.id}">${h.name}</option>`
  ).join("");

  pickup.value = HUBS[0].id;
  drop.value = "dnyanada-school";
  driverHub.value = state.driver.hubId;

  $("#emergency-name").value = state.emergencyContact.name || "";
  $("#emergency-phone").value = state.emergencyContact.phone || "";
  $("#mapbox-token").value = getMapboxToken();
}

function setMapStatus(text) {
  const el = $("#map-status");
  if (el) el.textContent = text;
}

function ensureBookingMap() {
  if (!hasMapbox()) return null;
  if (!bookingMap) bookingMap = new HopMap("#booking-map");
  bookingMap.init();
  $("#booking-map").dataset.mapbox = "1";
  return bookingMap;
}

function ensureRideMap() {
  if (!hasMapbox()) return null;
  const host = $("#live-map-rider");
  if (!host) return null;
  if (!rideMap) rideMap = new HopMap(host);
  // If SVG fallback previously painted, clear once for Mapbox
  if (host.dataset.mapbox !== "1") {
    host.innerHTML = "";
    host.dataset.mapbox = "1";
  }
  rideMap.init();
  return rideMap;
}

async function refreshQuote() {
  const seq = ++quoteSeq;
  const hub = hubById($("#pickup-hub").value);
  const place = placeById($("#drop-place").value);
  const fare = fareFor(hub.zone, place.zone);

  const pickup = gpsPickup || hubLatLng(hub);
  const drop = placeLatLng(place);

  let km = distanceFor(hub.zone, place.zone);
  let etaMins = hub.etaMins;
  let routeGeometry = null;
  let etaProvider = "zone-estimate";

  $("#fare-display").textContent = `₹${fare}`;
  $("#distance-display").textContent = `${km.toFixed(1)} km`;
  $("#sla-display").textContent = `~${etaMins} min`;
  $("#promise-eta").textContent = `~${etaMins}`;
  $("#eta-provider-badge").textContent = gpsPickup ? "GPS pickup" : "Hub pickup";

  const gpsLabel = $("#gps-pickup-label");
  if (gpsPickup) {
    gpsLabel.hidden = false;
    gpsLabel.textContent = `GPS pickup active (${gpsPickup.lat.toFixed(5)}, ${gpsPickup.lng.toFixed(5)}) · nearest hub ${hub.name}`;
  } else {
    gpsLabel.hidden = true;
  }

  if (hasMapbox()) {
    setMapStatus("Fetching Mapbox road ETA…");
    try {
      const route = await fetchDrivingRoute(pickup, drop);
      if (seq !== quoteSeq) return lastQuote;
      km = route.distanceKm;
      etaMins = route.durationMin;
      routeGeometry = route.geometry;
      etaProvider = "mapbox";

      $("#distance-display").textContent = `${km.toFixed(2)} km`;
      $("#sla-display").textContent = `${etaMins} min`;
      $("#promise-eta").textContent = `~${etaMins}`;
      $("#eta-provider-badge").textContent = "Mapbox ETA";
      setMapStatus(`Mapbox driving · ${km.toFixed(2)} km · ${etaMins} min`);

      const map = ensureBookingMap();
      if (map) {
        map.setMarker("pickup", pickup, { label: "P", className: "mbx-pickup" });
        map.setMarker("drop", drop, { label: "D", className: "mbx-drop" });
        map.setRoute(routeGeometry);
        map.fitPoints([pickup, drop]);
      }
    } catch (err) {
      if (seq !== quoteSeq) return lastQuote;
      console.warn(err);
      setMapStatus(`Mapbox ETA unavailable — using zone estimate. ${err.message || ""}`);
      $("#eta-provider-badge").textContent = "Estimate";
      const map = ensureBookingMap();
      if (map) {
        map.setMarker("pickup", pickup, { label: "P", className: "mbx-pickup" });
        map.setMarker("drop", drop, { label: "D", className: "mbx-drop" });
        map.setRoute(null);
        map.fitPoints([pickup, drop]);
      }
    }
  } else {
    setMapStatus("Add Mapbox token below for live map + real road ETA. Zone estimate shown now.");
    $("#eta-provider-badge").textContent = "Estimate";
  }

  lastQuote = {
    hub,
    place,
    fare,
    km,
    etaMins,
    pickup,
    drop,
    routeGeometry,
    etaProvider,
    fromGps: !!gpsPickup,
  };
  return lastQuote;
}

function quote() {
  return refreshQuote();
}

async function useMyGps() {
  try {
    setMapStatus("Getting GPS…");
    toast("Requesting location permission…");
    const pos = await getCurrentPosition();
    if (!isNearWagholi(pos, 12)) {
      toast("GPS looks far from Wagholi — still using it for demo");
    }
    gpsPickup = pos;
    const near = nearestPoint(
      pos,
      HUBS.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, name: h.name }))
    );
    if (near) $("#pickup-hub").value = near.id;
    await refreshQuote();
    toast(`GPS locked · ±${Math.round(pos.accuracy || 0)}m`);
  } catch (err) {
    console.warn(err);
    toast(err.message || "Could not get GPS");
    setMapStatus("GPS denied or unavailable. Allow location and try again.");
  }
}

function saveToken() {
  const token = setMapboxToken($("#mapbox-token").value);
  if (!token) {
    toast("Paste a Mapbox public token (pk.…)");
    return;
  }
  if (!window.mapboxgl) {
    toast("Mapbox SDK not loaded — refresh the page");
    return;
  }
  bookingMap?.destroy();
  bookingMap = null;
  rideMap?.destroy();
  rideMap = null;
  const host = $("#booking-map");
  if (host) {
    host.dataset.mapbox = "";
    host.innerHTML = "";
  }
  toast("Mapbox token saved");
  refreshQuote();
}

function renderSavedPlaces() {
  const favorites = PLACES.filter((p) =>
    ["school", "clinic", "market", "grocery"].includes(p.kind)
  );
  $("#saved-places").innerHTML = favorites
    .map(
      (p) =>
        `<button class="chip" type="button" data-place="${p.id}">${p.name}</button>`
    )
    .join("");
}

function renderHistory() {
  const list = $("#trip-history");
  if (!state.history.length) {
    list.innerHTML = `<li class="empty-state">No trips yet. Book your first 2 km hop.</li>`;
    return;
  }
  list.innerHTML = state.history
    .slice(0, 8)
    .map(
      (t) => `<li class="list-item">
        <strong>${t.from} → ${t.to}</strong>
        <small>₹${t.fare} · ${Number(t.km).toFixed(2)} km · ${t.status}${t.sos ? " · SOS" : ""} · ${t.etaProvider || ""} · ${new Date(t.at).toLocaleString()}</small>
      </li>`
    )
    .join("");
}

function paintRideMap(ride) {
  if (!hasMapbox()) {
    renderTrackMap($("#live-map-rider"), ride, { label: "🛺" });
    return;
  }
  const map = ensureRideMap();
  if (!map) {
    renderTrackMap($("#live-map-rider"), ride, { label: "🛺" });
    return;
  }
  const pickup = ride.pickup || {
    lat: ride.pickupCoords?.lat,
    lng: ride.pickupCoords?.lng,
  };
  const drop = ride.drop || {
    lat: ride.dropCoords?.lat,
    lng: ride.dropCoords?.lng,
  };
  const vehicle = vehicleLatLng(ride);

  if (pickup?.lat != null) map.setMarker("pickup", pickup, { label: "P", className: "mbx-pickup" });
  if (drop?.lat != null) map.setMarker("drop", drop, { label: "D", className: "mbx-drop" });
  if (vehicle) map.setMarker("vehicle", vehicle, { label: "🛺", className: "mbx-vehicle" });
  map.setRoute(ride.routeGeometry || null);

  const pts = [pickup, drop, vehicle].filter((p) => p?.lat != null);
  map.fitPoints(pts);
}

function renderActiveRide() {
  const card = $("#active-ride-card");
  const ride = state.activeRide;
  if (!ride) {
    card.hidden = true;
    document.body.classList.remove("sos-mode");
    clearInterval(etaTimer);
    clearInterval(trackTimer);
    publishLive(null);
    return;
  }
  card.hidden = false;
  const live = ["on_trip", "driver_assigned", "arrived"].includes(ride.status);
  $("#ride-status-dot").classList.toggle("live", live);
  $("#sos-banner-rider").hidden = !ride.sos;
  document.body.classList.toggle("sos-mode", !!ride.sos);
  $("#safety-line").textContent = statusSafetyLabel(ride.status);

  const statusLabel = {
    searching: "Finding nearest hub vehicle…",
    driver_assigned: `${ride.driverName} is arriving`,
    arrived: "Driver arrived — share OTP",
    on_trip: "Trip in progress · live GPS tracking on",
    completed: "Completed",
    cancelled: "Cancelled",
  }[ride.status];

  const etaNote = ride.etaProvider === "mapbox" ? "Mapbox ETA" : "Est. ETA";

  $("#active-ride").innerHTML = `
    <div class="list-item">
      <strong>${ride.from} → ${ride.to}</strong>
      <small>${statusLabel}</small>
      <small>Fare ₹${ride.fare} · OTP <strong>${ride.otp}</strong> · ${etaNote} ${ride.etaMins} min · ${Number(ride.km).toFixed(2)} km</small>
      ${ride.vehicle ? `<small>Vehicle: ${ride.vehicle}</small>` : ""}
      ${ride.vehicleGps ? `<small>GPS: ${ride.vehicleGps.lat.toFixed(5)}, ${ride.vehicleGps.lng.toFixed(5)}</small>` : ""}
      ${ride.sos ? `<small>SOS active since ${new Date(ride.sosAt).toLocaleTimeString()}</small>` : ""}
    </div>
  `;

  paintRideMap(ride);
  startTrackLoop();
}

function startTrackLoop() {
  clearInterval(trackTimer);
  trackTimer = setInterval(() => {
    if (!state.activeRide) {
      clearInterval(trackTimer);
      return;
    }
    syncLivePublish();
    paintRideMap(state.activeRide);
    $("#safety-line").textContent = statusSafetyLabel(state.activeRide.status);
  }, 1500);
}

function startDriverGps() {
  clearWatch(driverWatchId);
  driverWatchId = watchPosition(
    (pos) => {
      state.driver.lastGps = pos;
      const ride = state.activeRide;
      if (ride && state.driver.activeTripId === ride.id) {
        ride.vehicleGps = pos;
        persist();
      }
    },
    (err) => console.warn("Driver GPS", err)
  );
}

function stopDriverGps() {
  clearWatch(driverWatchId);
  driverWatchId = null;
}

function simulateAssignment(rideId) {
  setTimeout(() => {
    const ride = state.activeRide;
    if (!ride || ride.id !== rideId || ride.status !== "searching") return;

    const onlineDriver = state.driver.online && !state.driver.activeTripId;
    const driverName = onlineDriver
      ? "You (demo driver)"
      : DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)];

    ride.status = "driver_assigned";
    ride.assignedAt = Date.now();
    ride.driverName = driverName;
    ride.vehicle = Math.random() > 0.45 ? "E-rickshaw · MH12 ER" : "Auto · MH12 AB";
    if (!ride.etaMins) ride.etaMins = Math.max(3, (hubById(ride.hubId)?.etaMins ?? 6) - 1);
    if (onlineDriver && state.driver.lastGps) ride.vehicleGps = state.driver.lastGps;
    persist();
    renderActiveRide();
    toast(`${driverName} accepted · live track started`);

    if (onlineDriver) {
      state.driver.activeTripId = ride.id;
      state.queue = state.queue.filter((q) => q.id !== ride.id);
      persist();
      renderDriver();
      startDriverGps();
    } else {
      setTimeout(() => {
        if (state.activeRide?.id === rideId && state.activeRide.status === "driver_assigned") {
          state.activeRide.status = "arrived";
          persist();
          renderActiveRide();
          toast("Driver arrived at pickup");
        }
      }, 5000);
    }

    startEtaCountdown();
  }, 2200 + Math.random() * 1200);
}

function startEtaCountdown() {
  clearInterval(etaTimer);
  etaTimer = setInterval(() => {
    const ride = state.activeRide;
    if (!ride || ride.status === "completed" || ride.status === "cancelled") {
      clearInterval(etaTimer);
      return;
    }
    if (ride.status === "on_trip") return;
    if (ride.etaMins > 1) {
      ride.etaMins -= 1;
      persist();
      renderActiveRide();
    }
  }, 15000);
}

async function bookRide() {
  if (state.activeRide && !["completed", "cancelled"].includes(state.activeRide.status)) {
    toast("Finish or cancel your active ride first");
    return;
  }

  const q = lastQuote || (await refreshQuote());
  if (q.km > SERVICE_RADIUS_KM) {
    toast(`Out of service area (${q.km.toFixed(2)} km > ${SERVICE_RADIUS_KM} km).`);
    return;
  }

  const hub = q.hub;
  const place = q.place;
  const pickupPct = coordsForHub(hub.id);
  const dropPct = coordsForPlace(place.id);

  const ride = {
    id: uid("ride"),
    hubId: hub.id,
    placeId: place.id,
    from: q.fromGps ? `GPS near ${hub.name}` : hub.name,
    to: place.name,
    fromZone: hub.zone,
    toZone: place.zone,
    pickup: q.pickup,
    drop: q.drop,
    pickupCoords: { ...pickupPct, lat: q.pickup.lat, lng: q.pickup.lng },
    dropCoords: { ...dropPct, lat: q.drop.lat, lng: q.drop.lng },
    routeGeometry: q.routeGeometry,
    etaProvider: q.etaProvider,
    fare: q.fare,
    km: q.km,
    otp: otp4(),
    status: "searching",
    etaMins: q.etaMins,
    driverName: null,
    vehicle: null,
    vehicleGps: null,
    sos: false,
    sosAt: null,
    assignedAt: null,
    tripStartedAt: null,
    createdAt: Date.now(),
  };

  state.activeRide = ride;
  state.queue.unshift({
    id: ride.id,
    from: ride.from,
    to: ride.to,
    fare: ride.fare,
    hubId: ride.hubId,
    expiresAt: Date.now() + 90_000,
  });
  persist();
  renderActiveRide();
  renderDriver();
  toast(
    q.etaProvider === "mapbox"
      ? `Searching… Mapbox ETA ${q.etaMins} min`
      : "Searching nearest hub vehicle…"
  );
  simulateAssignment(ride.id);
}

function cancelRide() {
  if (!state.activeRide) return;
  const ride = state.activeRide;
  ride.status = "cancelled";
  state.history.unshift({
    from: ride.from,
    to: ride.to,
    fare: ride.fare,
    km: ride.km,
    status: "cancelled",
    sos: !!ride.sos,
    etaProvider: ride.etaProvider,
    at: Date.now(),
  });
  state.queue = state.queue.filter((q) => q.id !== ride.id);
  if (state.driver.activeTripId === ride.id) state.driver.activeTripId = null;
  state.activeRide = null;
  persist();
  renderActiveRide();
  renderHistory();
  renderDriver();
  toast("Ride cancelled");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

async function shareLiveTrack() {
  const ride = state.activeRide;
  if (!ride) return;
  const snap = buildLiveSnapshot(ride, state.emergencyContact);
  const url = liveTrackUrl(snap);
  const text = shareText(ride, url);

  if (navigator.share) {
    try {
      await navigator.share({ title: "WagholiHop live track", text, url });
      toast("Live track shared");
      return;
    } catch {
      /* fall through */
    }
  }

  const ok = await copyText(text);
  toast(ok ? "Live track link copied" : url);
}

async function shareRide() {
  const ride = state.activeRide;
  if (!ride) return;
  const snap = buildLiveSnapshot(ride, state.emergencyContact);
  const url = liveTrackUrl(snap);
  const text =
    `WagholiHop trip: ${ride.from} → ${ride.to}. ` +
    `Driver ${ride.driverName || "pending"}. OTP ${ride.otp}. ` +
    `Live: ${url}`;
  const ok = await copyText(text);
  toast(ok ? "Trip + live link copied" : text);
}

async function triggerSos() {
  const ride = state.activeRide;
  if (!ride) return;

  ride.sos = true;
  ride.sosAt = Date.now();
  persist();
  renderActiveRide();

  const snap = buildLiveSnapshot(ride, state.emergencyContact);
  const url = liveTrackUrl(snap);
  const contact = state.emergencyContact;
  const alertText =
    `🚨 WagholiHop SOS\n` +
    `Rider needs help on ${ride.from} → ${ride.to}\n` +
    `Driver: ${ride.driverName || "unknown"} · ${ride.vehicle || "—"}\n` +
    (ride.vehicleGps
      ? `GPS: ${ride.vehicleGps.lat}, ${ride.vehicleGps.lng}\n`
      : "") +
    `Live track: ${url}\n` +
    (contact.phone ? `Also alert: ${contact.name || "contact"} ${contact.phone}\n` : "") +
    `Call ${EMERGENCY_INDIA} if needed.`;

  await copyText(alertText);

  if (contact.phone) {
    const wa = `https://wa.me/91${contact.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(alertText)}`;
    window.open(wa, "_blank");
  }

  window.location.href = `tel:${EMERGENCY_INDIA}`;
  toast("SOS alert prepared — live link copied");
}

function saveEmergency() {
  state.emergencyContact = {
    name: $("#emergency-name").value.trim(),
    phone: $("#emergency-phone").value.trim(),
  };
  persist();
  toast(
    state.emergencyContact.phone
      ? `Saved ${state.emergencyContact.name || "contact"}`
      : "Add a phone number for SOS WhatsApp"
  );
}

function renderDriver() {
  const online = state.driver.online;
  $("#driver-online").checked = online;
  $("#driver-online-label").textContent = online
    ? `Online at ${hubById(state.driver.hubId)?.name ?? "hub"} · GPS ${state.driver.lastGps ? "on" : "waiting"}`
    : "You're offline";
  $("#driver-earnings").textContent = `₹${state.driver.earnings}`;
  $("#driver-trips").textContent = String(state.driver.trips);
  $("#driver-hub").value = state.driver.hubId;

  const box = $("#driver-requests");
  const activeId = state.driver.activeTripId;

  if (!online) {
    box.className = "list empty-state";
    box.textContent = "Go online to receive nearby short-hop pings.";
  } else if (activeId) {
    box.className = "list empty-state";
    box.textContent = "Complete your current trip to get new pings.";
  } else {
    const open = state.queue.filter((q) => q.expiresAt > Date.now());
    if (!open.length) {
      box.className = "list empty-state";
      box.textContent = "No requests near your hub. Stay parked — peak is school & evening market.";
    } else {
      box.className = "list";
      box.innerHTML = open
        .map((q) => {
          const sec = Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000));
          return `<div class="list-item request-item" data-req="${q.id}">
            <strong>${q.from} → ${q.to}</strong>
            <div class="meta"><span>₹${q.fare} fixed</span><span class="countdown" data-cd="${q.id}">${sec}s</span></div>
            <div class="ride-actions">
              <button class="danger-btn reject-btn" type="button" data-id="${q.id}">Reject</button>
              <button class="primary-btn accept-btn" type="button" data-id="${q.id}">Accept</button>
            </div>
          </div>`;
        })
        .join("");
    }
  }

  const activeCard = $("#driver-active-card");
  const ride =
    state.activeRide && state.driver.activeTripId === state.activeRide.id
      ? state.activeRide
      : null;

  if (!ride) {
    activeCard.hidden = true;
    return;
  }

  activeCard.hidden = false;
  $("#driver-active").innerHTML = `
    <div class="list-item">
      <strong>${ride.from} → ${ride.to}</strong>
      <small>Status: ${ride.status.replaceAll("_", " ")}${ride.sos ? " · SOS" : ""}</small>
      <small>Collect OTP from rider to start · Fare ₹${ride.fare}</small>
      <small>${ride.etaProvider === "mapbox" ? "Mapbox route active" : "Estimated route"} · your GPS broadcasts while online</small>
    </div>
  `;

  $("#arrived-btn").hidden = ride.status !== "driver_assigned";
  $("#start-trip-btn").hidden = ride.status !== "arrived";
  $("#complete-trip-btn").hidden = ride.status !== "on_trip";
}

function acceptRequest(id) {
  const req = state.queue.find((q) => q.id === id);
  if (!req || !state.driver.online) return;
  if (state.driver.activeTripId) {
    toast("Finish current trip first");
    return;
  }

  const ride = state.activeRide?.id === id ? state.activeRide : null;
  if (!ride) {
    toast("Request expired");
    state.queue = state.queue.filter((q) => q.id !== id);
    persist();
    renderDriver();
    return;
  }

  ride.status = "driver_assigned";
  ride.assignedAt = Date.now();
  ride.driverName = "You (demo driver)";
  ride.vehicle = "E-rickshaw · DEMO";
  if (state.driver.lastGps) ride.vehicleGps = state.driver.lastGps;
  state.driver.activeTripId = ride.id;
  state.queue = state.queue.filter((q) => q.id !== id);
  persist();
  renderActiveRide();
  renderDriver();
  startDriverGps();
  toast("Trip accepted — GPS live tracking on");
  startEtaCountdown();
}

function rejectRequest(id) {
  state.queue = state.queue.filter((q) => q.id !== id);
  persist();
  renderDriver();
  toast("Request skipped");
}

function markArrived() {
  if (!state.activeRide) return;
  state.activeRide.status = "arrived";
  persist();
  renderActiveRide();
  renderDriver();
  toast("Marked arrived");
}

function startWithOtp(entered) {
  const ride = state.activeRide;
  if (!ride) return false;
  if (entered !== ride.otp) {
    toast("Wrong OTP");
    return false;
  }
  ride.status = "on_trip";
  ride.tripStartedAt = Date.now();
  persist();
  renderActiveRide();
  renderDriver();
  toast("Trip started · live GPS for family");
  return true;
}

function completeTrip() {
  const ride = state.activeRide;
  if (!ride) return;
  ride.status = "completed";
  state.history.unshift({
    from: ride.from,
    to: ride.to,
    fare: ride.fare,
    km: ride.km,
    status: "completed",
    sos: !!ride.sos,
    etaProvider: ride.etaProvider,
    at: Date.now(),
  });
  state.driver.earnings += ride.fare;
  state.driver.trips += 1;
  state.driver.activeTripId = null;
  state.activeRide = null;
  persist();
  renderActiveRide();
  renderHistory();
  renderDriver();
  toast(`Trip done · ₹${ride.fare} earned`);
}

function renderHubs() {
  const map = $("#hub-map");
  map.innerHTML = HUBS.map(
    (h) =>
      `<div class="hub-pin" style="left:${h.x}%;top:${h.y}%">${h.name.split(" ")[0]}<span>${h.vehicles} live</span></div>`
  ).join("");

  $("#hub-list").innerHTML = HUBS.map(
    (h) => `<li class="list-item">
      <strong>${h.name}</strong>
      <small>Zone ${h.zone} · ${h.lat.toFixed(4)}, ${h.lng.toFixed(4)} · ETA ~${h.etaMins} min</small>
    </li>`
  ).join("");

  $("#fare-zones").innerHTML = `
    <li class="list-item"><strong>Same zone</strong><small>₹30 · Mapbox distance when token set</small></li>
    <li class="list-item"><strong>Adjacent A↔B</strong><small>₹45 fixed fare</small></li>
    <li class="list-item"><strong>B↔C</strong><small>₹50 fixed fare</small></li>
    <li class="list-item"><strong>A↔C</strong><small>₹55 fixed fare</small></li>
    <li class="list-item"><strong>Hard cap</strong><small>${SERVICE_RADIUS_KM} km — outside WagholiHop area</small></li>
  `;
}

function tickCountdowns() {
  document.querySelectorAll("[data-cd]").forEach((el) => {
    const id = el.getAttribute("data-cd");
    const q = state.queue.find((x) => x.id === id);
    if (!q) return;
    const sec = Math.max(0, Math.ceil((q.expiresAt - Date.now()) / 1000));
    el.textContent = `${sec}s`;
    if (sec <= 0) {
      state.queue = state.queue.filter((x) => x.id !== id);
      persist();
      renderDriver();
    }
  });
}

function bind() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  $("#pickup-hub").addEventListener("change", () => {
    gpsPickup = null;
    refreshQuote();
  });
  $("#drop-place").addEventListener("change", () => refreshQuote());
  $("#book-btn").addEventListener("click", () => bookRide());
  $("#use-gps-btn").addEventListener("click", () => useMyGps());
  $("#refresh-eta-btn").addEventListener("click", () => refreshQuote());
  $("#save-token-btn").addEventListener("click", () => saveToken());
  $("#cancel-ride-btn").addEventListener("click", cancelRide);
  $("#share-ride-btn").addEventListener("click", shareRide);
  $("#share-live-btn").addEventListener("click", shareLiveTrack);
  $("#sos-btn").addEventListener("click", () => $("#sos-dialog").showModal());
  $("#save-emergency-btn").addEventListener("click", saveEmergency);

  $("#sos-form").addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (submitter?.value === "cancel") return;
    e.preventDefault();
    $("#sos-dialog").close();
    triggerSos();
  });

  $("#saved-places").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn) return;
    $("#drop-place").value = btn.dataset.place;
    refreshQuote();
  });

  $("#driver-online").addEventListener("change", (e) => {
    state.driver.online = e.target.checked;
    persist();
    if (state.driver.online) {
      startDriverGps();
      toast("Online — GPS broadcasting");
    } else {
      stopDriverGps();
      toast("Went offline");
    }
    renderDriver();
  });

  $("#driver-hub").addEventListener("change", (e) => {
    state.driver.hubId = e.target.value;
    persist();
    renderDriver();
  });

  $("#driver-requests").addEventListener("click", (e) => {
    const accept = e.target.closest(".accept-btn");
    const reject = e.target.closest(".reject-btn");
    if (accept) acceptRequest(accept.dataset.id);
    if (reject) rejectRequest(reject.dataset.id);
  });

  $("#arrived-btn").addEventListener("click", markArrived);
  $("#complete-trip-btn").addEventListener("click", completeTrip);

  $("#start-trip-btn").addEventListener("click", () => {
    $("#otp-input").value = "";
    $("#otp-dialog").showModal();
  });

  $("#otp-form").addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (submitter?.value === "cancel") return;
    e.preventDefault();
    const ok = startWithOtp($("#otp-input").value.trim());
    if (ok) $("#otp-dialog").close();
  });

  $("#refresh-hubs").addEventListener("click", () => {
    renderHubs();
    toast("Hub snapshot refreshed");
  });

  setInterval(tickCountdowns, 1000);
}

function init() {
  fillSelects();
  renderSavedPlaces();
  renderHistory();
  renderActiveRide();
  renderDriver();
  renderHubs();
  bind();
  refreshQuote();

  if (state.driver.online) startDriverGps();

  if (state.activeRide?.status === "searching") {
    simulateAssignment(state.activeRide.id);
  } else if (state.activeRide) {
    startEtaCountdown();
    startTrackLoop();
  }
}

init();

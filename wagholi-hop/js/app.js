import {
  HUBS,
  PLACES,
  DRIVER_NAMES,
  fareFor,
  distanceFor,
  hubById,
  placeById,
} from "./data.js";
import { loadState, saveState, uid, otp4 } from "./store.js";

const state = loadState();
let toastTimer;
let acceptTimers = new Map();
let etaTimer;

const $ = (sel) => document.querySelector(sel);

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function persist() {
  saveState(state);
}

function setMode(mode) {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${mode}`);
  });
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
}

function quote() {
  const hub = hubById($("#pickup-hub").value);
  const place = placeById($("#drop-place").value);
  const fare = fareFor(hub.zone, place.zone);
  const km = distanceFor(hub.zone, place.zone);
  $("#fare-display").textContent = `₹${fare}`;
  $("#distance-display").textContent = `${km.toFixed(1)} km`;
  $("#promise-eta").textContent = `~${hub.etaMins}`;
  return { hub, place, fare, km };
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
        <small>₹${t.fare} · ${t.km} km · ${t.status} · ${new Date(t.at).toLocaleString()}</small>
      </li>`
    )
    .join("");
}

function renderActiveRide() {
  const card = $("#active-ride-card");
  const ride = state.activeRide;
  if (!ride) {
    card.hidden = true;
    clearInterval(etaTimer);
    return;
  }
  card.hidden = false;
  const live = ride.status === "on_trip" || ride.status === "driver_assigned";
  $("#ride-status-dot").classList.toggle("live", live);

  const statusLabel = {
    searching: "Finding nearest hub vehicle…",
    driver_assigned: `${ride.driverName} is arriving`,
    arrived: "Driver arrived — share OTP",
    on_trip: "Trip in progress",
    completed: "Completed",
    cancelled: "Cancelled",
  }[ride.status];

  $("#active-ride").innerHTML = `
    <div class="list-item">
      <strong>${ride.from} → ${ride.to}</strong>
      <small>${statusLabel}</small>
      <small>Fare ₹${ride.fare} · OTP <strong>${ride.otp}</strong> · ETA ${ride.etaMins} min</small>
      ${ride.vehicle ? `<small>Vehicle: ${ride.vehicle}</small>` : ""}
    </div>
  `;
}

function simulateAssignment(rideId) {
  // Blinkit-style: assign from hub fleet in ~2–4s if drivers online, else mock fleet.
  setTimeout(() => {
    const ride = state.activeRide;
    if (!ride || ride.id !== rideId || ride.status !== "searching") return;

    const onlineDriver = state.driver.online && !state.driver.activeTripId;
    const driverName = onlineDriver
      ? "You (demo driver)"
      : DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)];

    ride.status = "driver_assigned";
    ride.driverName = driverName;
    ride.vehicle = Math.random() > 0.45 ? "E-rickshaw · MH12 ER" : "Auto · MH12 AB";
    ride.etaMins = Math.max(3, (hubById(ride.hubId)?.etaMins ?? 6) - 1);
    persist();
    renderActiveRide();
    toast(`${driverName} accepted · arriving in ~${ride.etaMins} min`);

    // If local driver is online, also put on their active trip
    if (onlineDriver) {
      state.driver.activeTripId = ride.id;
      state.queue = state.queue.filter((q) => q.id !== ride.id);
      persist();
      renderDriver();
    } else {
      // Auto progress mock fleet
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

function bookRide() {
  if (state.activeRide && !["completed", "cancelled"].includes(state.activeRide.status)) {
    toast("Finish or cancel your active ride first");
    return;
  }

  const { hub, place, fare, km } = quote();
  if (km > 2.5) {
    toast("Out of service area (>2.5 km). Use Ola/Uber.");
    return;
  }

  const ride = {
    id: uid("ride"),
    hubId: hub.id,
    from: hub.name,
    to: place.name,
    fromZone: hub.zone,
    toZone: place.zone,
    fare,
    km,
    otp: otp4(),
    status: "searching",
    etaMins: hub.etaMins,
    driverName: null,
    vehicle: null,
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
  toast("Searching nearest hub vehicle…");
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

function shareRide() {
  const ride = state.activeRide;
  if (!ride) return;
  const text = `WagholiHop trip: ${ride.from} → ${ride.to}. OTP ${ride.otp}. Fare ₹${ride.fare}. Track in app.`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast("Trip details copied"));
  } else {
    toast(text);
  }
}

/* ---------------- Driver ---------------- */

function renderDriver() {
  const online = state.driver.online;
  $("#driver-online").checked = online;
  $("#driver-online-label").textContent = online
    ? `Online at ${hubById(state.driver.hubId)?.name ?? "hub"}`
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
      <small>Status: ${ride.status.replaceAll("_", " ")}</small>
      <small>Collect OTP from rider to start · Fare ₹${ride.fare}</small>
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
  ride.driverName = "You (demo driver)";
  ride.vehicle = "E-rickshaw · DEMO";
  ride.etaMins = hubById(state.driver.hubId)?.etaMins ?? 5;
  state.driver.activeTripId = ride.id;
  state.queue = state.queue.filter((q) => q.id !== id);
  persist();
  renderActiveRide();
  renderDriver();
  toast("Trip accepted — navigate to pickup");
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
  persist();
  renderActiveRide();
  renderDriver();
  toast("Trip started");
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

/* ---------------- Hubs ---------------- */

function renderHubs() {
  const map = $("#hub-map");
  map.innerHTML = HUBS.map(
    (h) =>
      `<div class="hub-pin" style="left:${h.x}%;top:${h.y}%">${h.name.split(" ")[0]}<span>${h.vehicles} live</span></div>`
  ).join("");

  $("#hub-list").innerHTML = HUBS.map(
    (h) => `<li class="list-item">
      <strong>${h.name}</strong>
      <small>Zone ${h.zone} · ${h.vehicles} vehicles · typical ETA ${h.etaMins} min</small>
    </li>`
  ).join("");

  $("#fare-zones").innerHTML = `
    <li class="list-item"><strong>Same zone (A→A / B→B / C→C)</strong><small>₹30 · ~1 km</small></li>
    <li class="list-item"><strong>Adjacent A↔B</strong><small>₹45 · ~1.6 km</small></li>
    <li class="list-item"><strong>B↔C</strong><small>₹50 · ~1.8 km</small></li>
    <li class="list-item"><strong>A↔C</strong><small>₹55 · ~2.1 km</small></li>
    <li class="list-item"><strong>Hard cap</strong><small>2.5 km / ₹70 — outside WagholiHop area</small></li>
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

  $("#pickup-hub").addEventListener("change", quote);
  $("#drop-place").addEventListener("change", quote);
  $("#book-btn").addEventListener("click", bookRide);
  $("#cancel-ride-btn").addEventListener("click", cancelRide);
  $("#share-ride-btn").addEventListener("click", shareRide);

  $("#saved-places").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-place]");
    if (!btn) return;
    $("#drop-place").value = btn.dataset.place;
    quote();
  });

  $("#driver-online").addEventListener("change", (e) => {
    state.driver.online = e.target.checked;
    persist();
    renderDriver();
    toast(state.driver.online ? "You're online at hub" : "Went offline");
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
  quote();
  renderSavedPlaces();
  renderHistory();
  renderActiveRide();
  renderDriver();
  renderHubs();
  bind();

  // Resume mock assignment if page reloaded mid-search
  if (state.activeRide?.status === "searching") {
    simulateAssignment(state.activeRide.id);
  } else if (state.activeRide) {
    startEtaCountdown();
  }
}

init();

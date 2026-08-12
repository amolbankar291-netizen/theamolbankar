# WagholiHop

**Blinkit-speed last-mile rides inside Wagholi, Pune.**  
Auto / e-rickshaw short hops (≈ first 2 km) with a **under-10-minute** pickup promise.

Demo MVP lives in this folder — pure HTML/CSS/JS, no build step, data in `localStorage`.

## App links

### Android APK
After the Actions build finishes:

**https://github.com/amolbankar291-netizen/theamolbankar/releases/tag/wagholi-hop-android-latest**

Download **`wagholi-hop.apk`** → install on phone (allow unknown apps).

Re-build: Actions → **Build WagholiHop Android APK** → Run workflow.

### Web (GitHub Pages)
After Pages is enabled:

**https://amolbankar291-netizen.github.io/theamolbankar/**

| Page | Link |
|------|------|
| Rider / Driver app | https://amolbankar291-netizen.github.io/theamolbankar/ |
| Family live track | https://amolbankar291-netizen.github.io/theamolbankar/track.html |

## Promise

- Service area: Wagholi hubs + nearby junctions only  
- Max trip: ~2.5 km  
- Fixed zone fares (₹30–₹55 typical)  
- Hub-parked vehicles (not city-wide cab search)  
- Rider OTP to start trip  

## Production step 1 — Real GPS + Mapbox ETA

1. Create a free token: https://account.mapbox.com/access-tokens/
2. Open the app → expand **Production maps setup (Mapbox)**
3. Paste `pk.…` token → **Save token & enable maps**
4. Tap **Use my GPS** (allow location)
5. Choose drop → app fetches **Mapbox Directions** road distance + ETA
6. Book → active ride / family `track.html` use Mapbox route + live marker  
   (Driver mode online broadcasts real GPS via `watchPosition`)

Fallback without token: zone fares + SVG demo map still work.

Optional: `http://localhost:5177/?mapbox=pk.YOUR_TOKEN`

Google Maps can be added next as an alternate provider behind the same `maps.js` interface.

## Safety pack

- **Live map** on the active ride (vehicle moves pickup → drop)
- **Share live track** → opens `track.html` for family (link in WhatsApp)
- **Safety contact** saved in the app (name + phone)
- **SOS** → copies alert + live link, opens WhatsApp to contact, dials **112**
- OTP still required before trip start  

> Demo tracking is simulated from trip timestamps (no real GPS yet). Production would stream driver location.

## Run locally

Any static server from this folder:

```bash
# Python
python -m http.server 5177

# or Node (if installed)
npx --yes serve .
```

Open `http://localhost:5177`.

Or open `index.html` directly in a modern browser (modules need a local server for some browsers).

## App modes

| Mode | What it does |
|------|----------------|
| **Rider** | Pick hub → drop place → fixed fare → book → track OTP trip |
| **Driver** | Go online at a hub → accept 90s pings → arrive → OTP start → complete |
| **Hubs** | Live hub map + fare zones for ops |

## Try the demo flow

1. Save a **Safety contact** (name + phone)  
2. **Rider** → Book from *Park Street* to *School*  
3. After assign → **Share live track** (open link / send to family)  
4. Switch to **Driver** → Online → Accept → Arrived → OTP → trip moves on the map  
5. Tap **SOS** anytime to alert contact + 112 shortcut

## Repo location

Part of [`theamolbankar`](https://github.com/amolbankar291-netizen/theamolbankar)  
Path: `wagholi-hop/`

## Next (production)

- Real GPS + Mapbox/Google ETA  
- Firebase/Supabase realtime matching  
- Razorpay UPI  
- Capacitor Android/iOS wrap (same pattern as Fortuner Rush in this repo)  
- Society + school WhatsApp onboarding  

## Stack

Vanilla ES modules · CSS variables · localStorage · PWA manifest

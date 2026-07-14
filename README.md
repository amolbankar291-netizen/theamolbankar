# 🏁 Fortuner Rush

A **Fast & Furious-style 3D arcade street racer**. Weave through traffic at insane speed,
chain **near-miss combos** for huge score multipliers, trigger **nitro**, escape a
**police chase**, bank coins to **unlock faster cars in the garage**, and race through a
live **day → night city** — playable in any browser and shippable as a **native Android
& iOS app**.

Built with [**Three.js**](https://threejs.org) (WebGL 3D) + [**Vite**](https://vitejs.dev),
and wrapped for mobile with [**Capacitor**](https://capacitorjs.com).
Everything (cars, traffic, cops, city, world) is generated **procedurally in code** — there
are **no external 3D/image/audio asset files**, so it runs anywhere and installs tiny.

---

## 📲 Install on your Android phone (no PC setup needed)

Every push to `main` triggers a GitHub Actions workflow that builds a real,
installable **debug APK** in the cloud and publishes it to the repo's Releases.

1. Open the **[Releases page](https://github.com/amolbankar291-netizen/theamolbankar/releases)**
   on your Android phone (look for **"Fortuner Rush (Android APK)"** / tag `android-latest`).
2. Download **`fortuner-rush.apk`**.
3. Tap the file → if prompted, allow **"Install unknown apps"** for your browser → **Install**.

> First build takes a few minutes. You can watch progress under the repo's **Actions** tab.
> (This is a debug build for sideloading — for a Play Store release, see the signing steps below.)

---

## ✨ Features

- 🚗 **4 unlockable cars** in a **Garage** — Fortuner SUV, Neon Speedster, Charger R/T,
  Velocity X — each with unique **speed / acceleration / handling** stats
- 🪙 **Coin economy**: bank coins between runs to buy faster cars (progress is saved)
- 💥 **Near-miss combo system** — shave past traffic for score **multipliers up to x8** + free nitro
- 🚓 **Police chase & wanted level** (★–★★★★★) — cop cars with flashing lights hunt you and
  fall back when you nitro; lose them to cut your heat
- 🔥 **Nitro boost** with rechargeable meter, exhaust flame, sparks & camera shake
- 🏙️ **Neon night city** — buildings with lit windows, streetlights, moon/sun, day↔night cycle
- ⚡ **Real sense of speed** — dynamic FOV, speed-line & vignette overlays, screen shake
- ✨ **Particle FX** — coin bursts, nitro sparks, crash debris
- 🎮 Multi-input controls: **keyboard**, **on-screen buttons**, and **phone tilt**
- 🔊 Zero-file **WebAudio** — engine drone, turbo whoosh, siren, coin & crash SFX
- 🏆 Persistent **best score** & coin bank (localStorage)
- 📱 Mobile-first, responsive, safe-area aware UI

---

## 🎮 How to play

- **Weave through traffic** — the closer you pass without crashing, the bigger your
  **near-miss combo** and score multiplier.
- **Grab coins** to build your bank, then head to the **Garage** to unlock quicker cars.
- Driving fast raises your **wanted level** — **cops** will chase. Hit **nitro** to
  outrun them and shake the heat.

| Action | Keyboard | Touch | Motion |
| ------ | -------- | ----- | ------ |
| Steer left / right | `←` `→` or `A` `D` | on-screen `‹` `›` | tilt phone |
| Nitro | `Space` | 🔥 button | — |
| Restart (game over) | `Enter` | RACE AGAIN | — |

---

## 🚀 Run locally (browser)

Requires **Node.js 18+**.

```bash
npm install
npm run dev
```

Open the printed URL (e.g. `http://localhost:5173`). To test on your phone over the same
Wi‑Fi, use the Network URL Vite prints, or run `npm run preview` after a build.

Production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built app
```

---

## 📱 Build the native mobile apps

Capacitor wraps the built web app into real Android/iOS projects.

### One-time setup

```bash
npm install
npm run build
npx cap add android    # creates the android/ project  (needs Android Studio + JDK 17)
npx cap add ios        # creates the ios/ project       (macOS + Xcode only)
```

### Android (`.apk` / `.aab`)

```bash
npm run android        # build web -> sync -> open Android Studio
```

In Android Studio: **Run ▶** on a device/emulator, or
**Build → Generate Signed Bundle / APK** for a release build.

### iOS (`.ipa`) — macOS only

```bash
npm run ios            # build web -> sync -> open Xcode
```

In Xcode: pick a simulator/device and **Run ▶**, or **Product → Archive** to distribute.

> After changing any web code, re-run `npm run build && npx cap sync` (or the
> `npm run android` / `npm run ios` shortcuts) to push updates into the native shells.

---

## 🧩 Project structure

```
.
├── index.html            # App shell, HUD, menus, touch controls
├── vite.config.js        # Vite config (relative base for Capacitor WebView)
├── capacitor.config.json # Native app id / name / web dir
├── src/
│   ├── main.js           # Engine, world, game loop, garage, combos, police, FX
│   ├── models.js         # Procedural 3D models (cars, cops, coins, city, props)
│   ├── particles.js      # Pooled particle bursts (coins, nitro, crash)
│   ├── audio.js          # WebAudio SFX (engine, turbo, siren, coin, crash)
│   └── style.css         # UI / HUD / garage styling
└── README.md
```

---

## 🛠️ Tuning

Gameplay constants live in the `CONFIG` object at the top of `src/main.js`
(lane count, speeds, nitro power, spawn rates, etc.) — tweak and hot-reload.

---

## 📄 License

MIT — do whatever you like. Have fun and drive safe (in real life). 🚗💨

# 🏁 Fortuner Rush

A **unique 3D endless SUV driving game** starring a Toyota-Fortuner-style off‑roader.
Dodge traffic, grab coins, trigger **nitro**, and chase the horizon through a live
**day/night cycle** — playable in any browser and shippable as a **native Android & iOS app**.

Built with [**Three.js**](https://threejs.org) (WebGL 3D) + [**Vite**](https://vitejs.dev),
and wrapped for mobile with [**Capacitor**](https://capacitorjs.com).
Everything (the SUV, traffic, coins, world) is generated **procedurally in code** — there
are **no external 3D/image/audio asset files**, so it runs anywhere and installs tiny.

---

## ✨ Features

- 🚙 Detailed procedural **Fortuner SUV** (body, cabin, chrome grille, glass, head/tail lights)
- 🛣️ Infinite scrolling **3-lane highway** with painted lane markings & curbs
- 🚗 Randomized **traffic** (cars & trucks) with progressive difficulty
- 🪙 **Coin** pickups that boost your score
- 🔥 **Nitro boost** with a rechargeable meter + exhaust flame + camera shake
- 🌅 Dynamic **day → night** lighting (headlights & streetlights switch on at night)
- 🎮 Multi-input controls: **keyboard**, **on-screen buttons**, and **phone tilt**
- 🔊 Zero-file **WebAudio** engine drone + coin/nitro/crash SFX
- 🏆 Persistent **best score** (localStorage)
- 📱 Mobile-first, responsive, safe-area aware UI

---

## 🎮 Controls

| Action | Keyboard | Touch | Motion |
| ------ | -------- | ----- | ------ |
| Steer left / right | `←` `→` or `A` `D` | on-screen `‹` `›` | tilt phone |
| Nitro | `Space` | 🔥 button | — |
| Restart (game over) | `Enter` | RETRY | — |

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
│   ├── main.js           # Engine, world, game loop, state machine, input
│   ├── models.js         # Procedural 3D models (SUV, traffic, coins, props)
│   ├── audio.js          # WebAudio SFX + engine synth
│   └── style.css         # UI / HUD styling
└── README.md
```

---

## 🛠️ Tuning

Gameplay constants live in the `CONFIG` object at the top of `src/main.js`
(lane count, speeds, nitro power, spawn rates, etc.) — tweak and hot-reload.

---

## 📄 License

MIT — do whatever you like. Have fun and drive safe (in real life). 🚗💨

# Fortuner Racing Legends — Unity Setup (Phase 1)

This is a **fresh Unity 6 (URP) project skeleton**. The C# code is complete and
compiles, but scenes, prefabs, materials and the URP asset must be created in the
Unity Editor (they can't be authored as text). Follow the steps below in order.

---

## 1. Open the project
1. Open **Unity Hub → Add → Add project from disk**.
2. Select this folder: `theamolbankar/unity/FortunerRacingLegends`.
3. Open with **Unity 6 (6000.0 LTS)**. First open takes a few minutes while
   packages import.
4. If Package Manager reports a version error, open **Window → Package Manager**,
   find the package, and click **Update** to the verified version.

## 2. Enable URP (Universal Render Pipeline)
1. **Assets → Create → Rendering → URP Asset (with Universal Renderer)**. Save as
   `Assets/Settings/URP_Mobile.asset` (a renderer asset is created next to it).
2. **Edit → Project Settings → Graphics → Scriptable Render Pipeline Settings** →
   assign `URP_Mobile`.
3. **Edit → Project Settings → Quality** → assign the same URP asset to your
   quality levels (Low/Medium/High).
4. For mobile: in the URP asset disable HDR if you need extra perf, keep MSAA at
   2x, and set shadow distance ~60.

## 3. Layers & Tags
Create these (Edit → Project Settings → Tags and Layers):
- Layers: `Ground`, `Vehicle`, `AIVehicle`, `Checkpoint`, `Environment`.
- Tags: `Player`, `AI`, `Checkpoint`, `FinishLine`.

## 4. Boot scene + GameManager
1. Create `Assets/Scenes/Boot.unity`.
2. Create an empty GameObject **GameManager**, add the `GameManager` component.
   Make it a prefab in `Assets/Prefabs/Core/`.
3. (Optional) Add an empty **Bootstrap** object with the `Bootstrap` component and
   assign the GameManager prefab — this guarantees the manager exists even if you
   press Play from another scene.
4. Add **Boot**, **MainMenu**, and each track scene to **Build Settings** (File →
   Build Settings → Add Open Scenes). Boot must be index 0.

## 5. Content assets (ScriptableObjects)
Create these via the **Assets → Create → Fortuner** menu:
1. **Car Data** for each car (`Assets/Data/Cars/`). Set `carId`, `displayName`,
   `price`, stat bars and physics values. Assign the car **prefab** (see step 6).
2. **Track Data** for each track (`Assets/Data/Tracks/`). Set `sceneName` to the
   matching scene in Build Settings.
3. **Upgrade Data** — one per `UpgradeType` (Engine, Turbo, Transmission, Brakes,
   Suspension, Tires, Nitro) in `Assets/Data/Upgrades/`.
4. **Game Config** (`Assets/Data/GameConfig.asset`) — drag all the cars, tracks
   and upgrades into its lists.

## 6. Build a drivable car prefab
1. Import/model a car mesh, or use a placeholder box while iterating.
2. Root GameObject: add **Rigidbody** (mass ~1500), add `CarController` and
   `CarInput`.
3. Add an empty child **CenterOfMass** placed low and slightly forward; assign it
   to `CarController`.
4. Add 4 child objects **WheelFL/FR/RL/RR**, each with a **WheelCollider**
   (radius/suspension tuned to the mesh). Assign them to `CarController`.
5. For each wheel, add a wheel **mesh** child and a `WheelVisual` component
   referencing that wheel's collider + mesh.
6. Suggested WheelCollider values: Suspension Distance 0.2, Spring 35000,
   Damper 4500, Target Position 0.5; Forward/Sideways friction ~1.5 stiffness.
7. Save as a prefab in `Assets/Prefabs/Cars/` and assign to the matching Car Data.

## 7. Ground / test track
1. Create a plane or simple mesh with a **Mesh Collider**, set layer `Ground`.
2. Add a directional light + a Global Volume (Post-processing) for bloom later
   (Phase 6).
3. Drop the car prefab in, press **Play**, and drive with **W/A/S/D**, **Space**
   = nitro, **Shift** = handbrake.

---

## Controls (default, keyboard)
| Action | Key |
| --- | --- |
| Steer | A / D or ← / → |
| Throttle | W / ↑ |
| Brake / Reverse | S / ↓ |
| Nitro | Space |
| Handbrake | Left Shift |

On mobile, wire on-screen buttons to `CarInput.SetSteer/SetThrottle/SetBrake/SetNitro/SetHandbrake` (Phase 5 UI).

## Android build (later)
- **File → Build Settings → Android → Switch Platform**.
- Player Settings: Minimum API 24+, Scripting Backend **IL2CPP**, Target
  Architectures **ARM64**, Color Space **Linear**.
- We'll add performance passes (GPU instancing, LOD, Addressables, texture
  compression) in Phase 7.

---

## What's in Phase 1 (this drop)
- `Core/` — GameManager (state machine), ServiceLocator, EventBus, Bootstrap.
- `Save/` — SaveData + JSON SaveSystem.
- `Economy/` — Wallet (coins/diamonds) with events.
- `Data/` — CarData, TrackData, UpgradeData, GameConfig ScriptableObjects.
- `Vehicle/` — CarController (WheelColliders, nitro, ABS, gears, recovery),
  CarInput, WheelVisual.
- `Utils/` — generic ObjectPool.

## Next phases
2. Vehicle polish (drift, ESP, damage, air control) · 3. Garage showroom ·
4. AI + RaceManager (laps/position/checkpoints) · 5. UI (menus + HUD, black/gold)
· 6. URP graphics (shaders, weather, day/night) · 7. Android optimization ·
8. Polish.

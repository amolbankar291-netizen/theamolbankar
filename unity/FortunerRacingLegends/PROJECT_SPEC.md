# Fortuner Racing Legends — Project Spec (Unity 6 / URP / Android)

A premium mobile racing game. This document is the source of truth for
architecture and scope so Cursor (and you) can generate consistent, high-quality
code phase by phase.

## Pillars
- **Feel:** responsive arcade-sim car handling, satisfying nitro, weighty braking.
- **Look:** AAA black / dark-gray / gold / yellow UI; URP with bloom, reflections,
  wet roads, day/night.
- **Loop:** race → earn coins/diamonds → upgrade / buy cars → unlock tracks →
  climb leaderboard, complete missions, daily rewards.
- **Performance:** stable 60 FPS on Snapdragon 695 / 778G / 8 Gen 2.

## Architecture
- **Composition over inheritance**, SOLID, one responsibility per class.
- **ServiceLocator** for cross-cutting singletons (SaveSystem, Wallet, Audio…).
- **EventBus** for decoupled communication (UI reacts to gameplay events).
- **ScriptableObjects** for all content/tuning (cars, tracks, upgrades, config) so
  designers balance without code changes.
- **Object pooling** for anything spawned at runtime.
- **Addressables** (Phase 7) for cars/tracks to keep memory + APK size down.

## Folder structure (Assets/)
```
Assets/
  Scenes/            Boot, MainMenu, Track_* scenes
  Scripts/
    Core/            GameManager, ServiceLocator, EventBus, GameState, Bootstrap
    Save/            SaveData, SaveSystem
    Economy/         Wallet  (+ later: RewardService, ShopService)
    Data/            CarData, TrackData, UpgradeData, GameConfig (ScriptableObjects)
    Vehicle/         CarController, CarInput, WheelVisual (+ later: Drift, Damage)
    AI/              (Phase 4) AIRacer, WaypointPath
    Race/            (Phase 4) RaceManager, Checkpoint, RacePositionTracker
    UI/              (Phase 5) MenuController, HUDController, screen views
    Audio/           (Phase 5/6) AudioService, EngineAudio
    Utils/           ObjectPool, extensions
  Data/              ScriptableObject instances (Cars/, Tracks/, Upgrades/)
  Prefabs/           Core/, Cars/, UI/, Environment/
  Art/               Models, Materials, Textures, VFX
  Settings/          URP assets, Volume profiles, Input actions
```

## Systems status
| System | Phase | Status |
| --- | --- | --- |
| Core state machine, DI, events | 1 | ✅ implemented |
| Save/load (JSON) | 1 | ✅ implemented |
| Economy (coins/diamonds) | 1 | ✅ implemented |
| Content data (SO) | 1 | ✅ implemented |
| Vehicle physics (WheelColliders) | 1/2 | ✅ base done, polish in 2 |
| Object pooling | 1 | ✅ implemented |
| Garage showroom | 3 | ⏳ planned |
| AI + race (laps/position) | 4 | ⏳ planned |
| UI (menus + HUD) | 5 | ⏳ planned |
| URP graphics/VFX | 6 | ⏳ planned |
| Android optimization | 7 | ⏳ planned |

## Vehicle model (Phase 1 base)
- Rear-wheel drive with slight front assist; speed-sensitive steering.
- Nitro adds top speed + torque and drains a config-driven meter; regenerates.
- Simple ABS eases brake torque on wheel lock; handbrake locks rear.
- Gear + RPM derived from normalized speed for HUD + engine audio.
- Downforce keeps the car planted; `Recover()` self-rights after a flip.
- All numbers come from `CarData` + per-car upgrade multipliers.

## Upgrade → stat mapping
| Upgrade | Affects |
| --- | --- |
| Engine | top speed |
| Turbo | nitro boost |
| Transmission | acceleration |
| Brakes | brake torque |
| Suspension | handling |
| Tires | handling / traction |
| Nitro | nitro capacity |

## Coding standards
- No pseudo-code, no `TODO`s, everything compiles.
- Namespaced under `FortunerRacing.*`.
- Public API documented with `<summary>`; keep methods small.
- Mobile-first: avoid per-frame allocations, cache components, use FixedUpdate for
  physics.

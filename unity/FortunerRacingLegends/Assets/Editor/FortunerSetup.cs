using System.Collections.Generic;
using FortunerRacing.CameraRig;
using FortunerRacing.Core;
using FortunerRacing.Data;
using FortunerRacing.Vehicle;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace FortunerRacing.EditorTools
{
    /// <summary>
    /// One-click Phase 1 scaffolding. Generates the ScriptableObject content,
    /// a drivable placeholder car prefab (Rigidbody + 4 WheelColliders wired to
    /// <see cref="CarController"/>), and a test scene you can press Play in.
    /// Everything it makes is normal editable assets you can tweak afterwards.
    /// </summary>
    public static class FortunerSetup
    {
        private const string DataDir = "Assets/Data";
        private const string CarsDir = "Assets/Data/Cars";
        private const string TracksDir = "Assets/Data/Tracks";
        private const string UpgradesDir = "Assets/Data/Upgrades";
        private const string PrefabsDir = "Assets/Prefabs/Cars";
        private const string ScenesDir = "Assets/Scenes";
        private const string ScenePath = "Assets/Scenes/TestTrack.unity";

        [MenuItem("Fortuner/Setup/Build Phase 1 Test Scene")]
        public static void BuildPhase1()
        {
            EnsureFolders();

            List<UpgradeData> upgrades = CreateUpgrades();
            CarData car = CreateCarData();
            TrackData track = CreateTrackData();
            GameConfig config = CreateGameConfig(car, track, upgrades);
            GameObject prefab = CreateCarPrefab(car, config);

            AssignReference(car, "prefab", prefab);
            EditorUtility.SetDirty(car);

            CreateTestScene(prefab);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "Fortuner Racing Legends",
                "Phase 1 test scene ready!\n\n" +
                "1) Open Assets/Scenes/TestTrack.unity\n" +
                "2) Press Play\n\n" +
                "Drive: W/A/S/D · Space = Nitro · Left Shift = Handbrake\n\n" +
                "(Enable URP via SETUP.md for the full look.)",
                "Great");
        }

        // ---------- Folders ----------
        private static void EnsureFolders()
        {
            EnsureFolder("Assets", "Data");
            EnsureFolder("Assets/Data", "Cars");
            EnsureFolder("Assets/Data", "Tracks");
            EnsureFolder("Assets/Data", "Upgrades");
            EnsureFolder("Assets", "Prefabs");
            EnsureFolder("Assets/Prefabs", "Cars");
            EnsureFolder("Assets", "Scenes");
            EnsureFolder("Assets", "Settings");
        }

        private static void EnsureFolder(string parent, string child)
        {
            if (!AssetDatabase.IsValidFolder($"{parent}/{child}"))
                AssetDatabase.CreateFolder(parent, child);
        }

        // ---------- ScriptableObjects ----------
        private static List<UpgradeData> CreateUpgrades()
        {
            var list = new List<UpgradeData>();
            var defs = new (UpgradeType type, string name, string desc, float per)[]
            {
                (UpgradeType.Engine, "Engine", "Improve engine power for higher top speed.", 0.05f),
                (UpgradeType.Turbo, "Turbo", "Boost nitro power.", 0.08f),
                (UpgradeType.Transmission, "Transmission", "Faster acceleration.", 0.05f),
                (UpgradeType.Brakes, "Brakes", "Stronger braking.", 0.07f),
                (UpgradeType.Suspension, "Suspension", "Sharper handling.", 0.03f),
                (UpgradeType.Tires, "Tires", "More traction.", 0.03f),
                (UpgradeType.Nitro, "Nitro System", "Larger nitro capacity.", 0.06f),
            };

            foreach (var d in defs)
            {
                var so = LoadOrCreate<UpgradeData>($"{UpgradesDir}/Upgrade_{d.type}.asset");
                so.type = d.type;
                so.displayName = d.name;
                so.description = d.desc;
                so.bonusPerLevel = d.per;
                so.maxLevel = 5;
                so.baseCost = 800;
                so.costPerLevel = 700;
                EditorUtility.SetDirty(so);
                list.Add(so);
            }
            return list;
        }

        private static CarData CreateCarData()
        {
            var car = LoadOrCreate<CarData>($"{CarsDir}/Car_Fortuner.asset");
            car.carId = "fortuner";
            car.displayName = "Fortuner GX";
            car.price = 0;
            car.defaultColorHex = "#1560FF";
            car.topSpeedStat = 0.72f;
            car.accelerationStat = 0.6f;
            car.handlingStat = 0.7f;
            car.brakingStat = 0.68f;
            car.nitroStat = 0.6f;
            car.maxSpeedKmh = 210f;
            car.motorTorque = 1600f;
            car.brakeTorque = 3200f;
            car.maxSteerAngle = 28f;
            car.mass = 1500f;
            car.nitroBoostKmh = 45f;
            car.downforce = 60f;
            EditorUtility.SetDirty(car);
            return car;
        }

        private static TrackData CreateTrackData()
        {
            var track = LoadOrCreate<TrackData>($"{TracksDir}/Track_Highway.asset");
            track.trackId = "highway";
            track.displayName = "OPEN HIGHWAY";
            track.subtitle = "Full throttle";
            track.sceneName = "TestTrack";
            track.laps = 3;
            track.coinReward = 500;
            track.diamondReward = 1;
            EditorUtility.SetDirty(track);
            return track;
        }

        private static GameConfig CreateGameConfig(CarData car, TrackData track, List<UpgradeData> upgrades)
        {
            var config = LoadOrCreate<GameConfig>($"{DataDir}/GameConfig.asset");
            config.cars = new List<CarData> { car };
            config.tracks = new List<TrackData> { track };
            config.upgrades = upgrades;
            EditorUtility.SetDirty(config);
            return config;
        }

        // ---------- Car prefab ----------
        private static GameObject CreateCarPrefab(CarData car, GameConfig config)
        {
            var root = new GameObject("Car_Fortuner");
            root.transform.position = Vector3.zero;

            var rb = root.AddComponent<Rigidbody>();
            rb.mass = car.mass;
            rb.linearDamping = 0.05f;
            rb.angularDamping = 0.5f;
            rb.interpolation = RigidbodyInterpolation.Interpolate;
            rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;

            var input = root.AddComponent<CarInput>();
            var controller = root.AddComponent<CarController>();

            // Body (keeps a BoxCollider for chassis collision)
            var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
            body.name = "Body";
            body.transform.SetParent(root.transform);
            body.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            body.transform.localScale = new Vector3(1.8f, 0.6f, 4.2f);

            // Center of mass (low + centered for stability)
            var com = new GameObject("CenterOfMass");
            com.transform.SetParent(root.transform);
            com.transform.localPosition = new Vector3(0f, 0.2f, 0f);

            // Wheels: FL, FR, RL, RR
            var fl = CreateWheel(root.transform, "WheelFL", new Vector3(-0.9f, 0.35f, 1.3f));
            var fr = CreateWheel(root.transform, "WheelFR", new Vector3(0.9f, 0.35f, 1.3f));
            var rl = CreateWheel(root.transform, "WheelRL", new Vector3(-0.9f, 0.35f, -1.3f));
            var rr = CreateWheel(root.transform, "WheelRR", new Vector3(0.9f, 0.35f, -1.3f));

            // Wire the controller's private serialized fields.
            AssignReference(controller, "carData", car);
            AssignReference(controller, "input", input);
            AssignReference(controller, "centerOfMass", com.transform);
            AssignReference(controller, "frontLeft", fl);
            AssignReference(controller, "frontRight", fr);
            AssignReference(controller, "rearLeft", rl);
            AssignReference(controller, "rearRight", rr);

            var prefab = PrefabUtility.SaveAsPrefabAsset(root, $"{PrefabsDir}/Car_Fortuner.prefab");
            Object.DestroyImmediate(root);
            return prefab;
        }

        private static WheelCollider CreateWheel(Transform parent, string name, Vector3 localPos)
        {
            var wheelGo = new GameObject(name);
            wheelGo.transform.SetParent(parent);
            wheelGo.transform.localPosition = localPos;

            var wc = wheelGo.AddComponent<WheelCollider>();
            wc.radius = 0.35f;
            wc.mass = 20f;
            wc.suspensionDistance = 0.2f;
            var spring = wc.suspensionSpring;
            spring.spring = 35000f;
            spring.damper = 4500f;
            spring.targetPosition = 0.5f;
            wc.suspensionSpring = spring;

            var fwd = wc.forwardFriction; fwd.stiffness = 1.6f; wc.forwardFriction = fwd;
            var side = wc.sidewaysFriction; side.stiffness = 1.8f; wc.sidewaysFriction = side;

            // Visual disc (placeholder) + WheelVisual sync
            var mesh = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mesh.name = name + "_Mesh";
            var meshCollider = mesh.GetComponent<Collider>();
            if (meshCollider != null) Object.DestroyImmediate(meshCollider);
            mesh.transform.SetParent(parent);
            mesh.transform.localPosition = localPos;
            mesh.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            mesh.transform.localScale = new Vector3(0.7f, 0.1f, 0.7f);

            var visual = wheelGo.AddComponent<WheelVisual>();
            AssignReference(visual, "wheelCollider", wc);
            AssignReference(visual, "wheelMesh", mesh.transform);

            return wc;
        }

        // ---------- Test scene ----------
        private static void CreateTestScene(GameObject carPrefab)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // Ground
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.localScale = new Vector3(4f, 1f, 40f);

            // Light
            var lightGo = new GameObject("Directional Light");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.shadows = LightShadows.Soft;
            light.intensity = 1.2f;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // Game manager
            var gm = new GameObject("GameManager");
            gm.AddComponent<GameManager>();

            // Car
            var carInstance = (GameObject)PrefabUtility.InstantiatePrefab(carPrefab);
            carInstance.transform.position = new Vector3(0f, 0.4f, 0f);

            // Camera
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();
            var chase = camGo.AddComponent<SimpleChaseCamera>();
            AssignReference(chase, "target", carInstance.transform);
            camGo.transform.position = new Vector3(0f, 4f, -8f);

            EditorSceneManager.SaveScene(scene, ScenePath);
            AddSceneToBuild(ScenePath);
        }

        private static void AddSceneToBuild(string path)
        {
            var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            if (!scenes.Exists(s => s.path == path))
            {
                scenes.Add(new EditorBuildSettingsScene(path, true));
                EditorBuildSettings.scenes = scenes.ToArray();
            }
        }

        // ---------- Helpers ----------
        private static T LoadOrCreate<T>(string path) where T : ScriptableObject
        {
            var existing = AssetDatabase.LoadAssetAtPath<T>(path);
            if (existing != null) return existing;
            var created = ScriptableObject.CreateInstance<T>();
            AssetDatabase.CreateAsset(created, path);
            return created;
        }

        /// <summary>Sets a private [SerializeField] reference via SerializedObject.</summary>
        private static void AssignReference(Object owner, string propertyName, Object value)
        {
            var so = new SerializedObject(owner);
            var prop = so.FindProperty(propertyName);
            if (prop != null)
            {
                prop.objectReferenceValue = value;
                so.ApplyModifiedPropertiesWithoutUndo();
            }
            else
            {
                Debug.LogWarning($"[FortunerSetup] Property '{propertyName}' not found on {owner.GetType().Name}.");
            }
        }
    }
}

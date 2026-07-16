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
        private const string ModelPath = "Assets/Models/suv.glb";
        private const string CarPrefabPath = "Assets/Prefabs/Cars/Car_Fortuner.prefab";

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

        [MenuItem("Fortuner/Setup/Rebuild Car Prefab")]
        public static void RebuildCar()
        {
            EnsureFolders();
            var car = AssetDatabase.LoadAssetAtPath<CarData>($"{CarsDir}/Car_Fortuner.asset") ?? CreateCarData();
            var config = AssetDatabase.LoadAssetAtPath<GameConfig>($"{DataDir}/GameConfig.asset");

            var prefab = CreateCarPrefab(car, config);
            AssignReference(car, "prefab", prefab);
            EditorUtility.SetDirty(car);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "Fortuner Racing Legends",
                "Car prefab rebuilt with the detailed SUV model.\n\n" +
                "Any Car_Fortuner already in your open scene updates automatically. Press Play to drive it.",
                "OK");
        }

        [MenuItem("Fortuner/Setup/Build Imported Car (glTF)")]
        public static void BuildImportedCar()
        {
            EnsureFolders();

            var gltf = AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath);
            if (gltf == null)
            {
                EditorUtility.DisplayDialog(
                    "Fortuner Racing Legends",
                    "Imported model not found at " + ModelPath + ".\n\n" +
                    "Check that:\n" +
                    "1) The glTFast package is installed\n" +
                    "   (Window > Package Manager > + > Add package by name >\n" +
                    "    com.unity.cloud.gltfast)\n" +
                    "2) Assets/Models/suv.glb imported with no red errors.",
                    "OK");
                return;
            }

            var car = AssetDatabase.LoadAssetAtPath<CarData>($"{CarsDir}/Car_Fortuner.asset") ?? CreateCarData();
            var config = AssetDatabase.LoadAssetAtPath<GameConfig>($"{DataDir}/GameConfig.asset");

            var prefab = CreateImportedCarPrefab(car, config, gltf);
            AssignReference(car, "prefab", prefab);
            EditorUtility.SetDirty(car);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "Fortuner Racing Legends",
                "Imported SUV car built!\n\n" +
                "Any Car_Fortuner in your open scene updated automatically.\n" +
                "Press Play to drive the real model with rolling/steering wheels.\n\n" +
                "If the model faces the wrong way or wheels spin oddly, tell me and\n" +
                "I'll flip the axis (it's exposed on the ModelWheelRig component too).",
                "OK");
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
            EnsureFolder("Assets", "Materials");
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
            car.defaultColorHex = "#F2F3F5";
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
        private const float WheelRadius = 0.38f;
        private static readonly Vector3 WFL = new Vector3(-0.86f, WheelRadius, 1.4f);
        private static readonly Vector3 WFR = new Vector3(0.86f, WheelRadius, 1.4f);
        private static readonly Vector3 WRL = new Vector3(-0.86f, WheelRadius, -1.4f);
        private static readonly Vector3 WRR = new Vector3(0.86f, WheelRadius, -1.4f);

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

            // Materials
            Color paint = ParseColor(car.defaultColorHex, new Color(0.08f, 0.38f, 1f));
            var matPaint = MakeMat("Car_Paint", paint, 0.45f, 0.72f);
            var matGlass = MakeMat("Car_Glass", new Color(0.04f, 0.05f, 0.07f), 0.2f, 0.92f);
            var matTrim = MakeMat("Car_Trim", new Color(0.07f, 0.07f, 0.08f), 0.3f, 0.45f);
            var matGrille = MakeMat("Car_Grille", new Color(0.03f, 0.03f, 0.035f), 0.7f, 0.6f);
            var matTire = MakeMat("Car_Tire", new Color(0.035f, 0.035f, 0.04f), 0.0f, 0.32f);
            var matRim = MakeMat("Car_Rim", new Color(0.78f, 0.79f, 0.83f), 0.9f, 0.8f);
            var matHead = MakeMat("Car_Headlight", new Color(0.9f, 0.9f, 0.85f), 0.1f, 0.9f,
                new Color(1f, 0.96f, 0.82f) * 2.2f);
            var matTail = MakeMat("Car_Taillight", new Color(0.2f, 0.02f, 0.02f), 0.1f, 0.9f,
                new Color(1f, 0.04f, 0.03f) * 2.6f);

            // Body parent (static visuals move with the rigidbody root)
            var bodyRoot = new GameObject("Body");
            bodyRoot.transform.SetParent(root.transform);
            bodyRoot.transform.localPosition = Vector3.zero;
            var b = bodyRoot.transform;

            // Lower body / chassis (carries the single collision box)
            var lower = Box(b, "LowerBody", new Vector3(0f, 0.74f, 0f), new Vector3(1.9f, 0.78f, 4.5f), matPaint, true);
            // Greenhouse (dark glass) + roof
            Box(b, "Greenhouse", new Vector3(0f, 1.24f, -0.15f), new Vector3(1.66f, 0.6f, 2.5f), matGlass);
            Box(b, "Roof", new Vector3(0f, 1.62f, -0.2f), new Vector3(1.64f, 0.32f, 2.15f), matPaint);
            // Roof rails
            Box(b, "RailL", new Vector3(-0.66f, 1.82f, -0.2f), new Vector3(0.07f, 0.07f, 1.9f), matTrim);
            Box(b, "RailR", new Vector3(0.66f, 1.82f, -0.2f), new Vector3(0.07f, 0.07f, 1.9f), matTrim);
            // Hood lip / bonnet accent
            Box(b, "Bonnet", new Vector3(0f, 1.06f, 1.55f), new Vector3(1.78f, 0.14f, 1.3f), matPaint);
            // Bumpers
            Box(b, "BumperF", new Vector3(0f, 0.5f, 2.3f), new Vector3(1.94f, 0.44f, 0.32f), matTrim);
            Box(b, "BumperR", new Vector3(0f, 0.5f, -2.3f), new Vector3(1.94f, 0.44f, 0.32f), matTrim);
            // Side skirts
            Box(b, "SkirtL", new Vector3(-0.96f, 0.42f, 0f), new Vector3(0.08f, 0.2f, 3.6f), matTrim);
            Box(b, "SkirtR", new Vector3(0.96f, 0.42f, 0f), new Vector3(0.08f, 0.2f, 3.6f), matTrim);
            // Grille
            Box(b, "Grille", new Vector3(0f, 0.82f, 2.31f), new Vector3(1.3f, 0.34f, 0.08f), matGrille);
            // Headlights
            Box(b, "HeadL", new Vector3(-0.66f, 0.9f, 2.3f), new Vector3(0.42f, 0.2f, 0.09f), matHead);
            Box(b, "HeadR", new Vector3(0.66f, 0.9f, 2.3f), new Vector3(0.42f, 0.2f, 0.09f), matHead);
            // Taillights
            Box(b, "TailL", new Vector3(-0.72f, 0.95f, -2.31f), new Vector3(0.34f, 0.3f, 0.08f), matTail);
            Box(b, "TailR", new Vector3(0.72f, 0.95f, -2.31f), new Vector3(0.34f, 0.3f, 0.08f), matTail);

            // Ensure only the chassis has a collider (remove primitive box colliders elsewhere)
            foreach (var col in bodyRoot.GetComponentsInChildren<Collider>(true))
                if (col.gameObject != lower) Object.DestroyImmediate(col);

            // Center of mass (low + centered for stability)
            var com = new GameObject("CenterOfMass");
            com.transform.SetParent(root.transform);
            com.transform.localPosition = new Vector3(0f, 0.15f, 0f);

            // Wheels: FL, FR, RL, RR
            var fl = CreateWheel(root.transform, "WheelFL", WFL, matTire, matRim);
            var fr = CreateWheel(root.transform, "WheelFR", WFR, matTire, matRim);
            var rl = CreateWheel(root.transform, "WheelRL", WRL, matTire, matRim);
            var rr = CreateWheel(root.transform, "WheelRR", WRR, matTire, matRim);

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

        private static WheelCollider CreateWheel(Transform parent, string name, Vector3 localPos, Material tireMat, Material rimMat)
        {
            var wheelGo = new GameObject(name);
            wheelGo.transform.SetParent(parent);
            wheelGo.transform.localPosition = localPos;

            var wc = wheelGo.AddComponent<WheelCollider>();
            wc.radius = WheelRadius;
            wc.mass = 20f;
            wc.suspensionDistance = 0.2f;
            var spring = wc.suspensionSpring;
            spring.spring = 35000f;
            spring.damper = 4500f;
            spring.targetPosition = 0.5f;
            wc.suspensionSpring = spring;

            var fwd = wc.forwardFriction; fwd.stiffness = 1.6f; wc.forwardFriction = fwd;
            var side = wc.sidewaysFriction; side.stiffness = 1.8f; wc.sidewaysFriction = side;

            // Wheel mesh root — WheelVisual drives this transform's pose (spin + steer).
            var meshRoot = new GameObject(name + "_Mesh");
            meshRoot.transform.SetParent(parent);
            meshRoot.transform.localPosition = localPos;

            // Tire + rim are children so the 90° axle alignment survives the pose updates.
            float d = WheelRadius * 2f;
            var tire = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tire.name = "Tire";
            RemoveCollider(tire);
            tire.transform.SetParent(meshRoot.transform);
            tire.transform.localPosition = Vector3.zero;
            tire.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            tire.transform.localScale = new Vector3(d, 0.14f, d);
            tire.GetComponent<MeshRenderer>().sharedMaterial = tireMat;

            var rim = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            rim.name = "Rim";
            RemoveCollider(rim);
            rim.transform.SetParent(meshRoot.transform);
            rim.transform.localPosition = Vector3.zero;
            rim.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            rim.transform.localScale = new Vector3(d * 0.6f, 0.16f, d * 0.6f);
            rim.GetComponent<MeshRenderer>().sharedMaterial = rimMat;

            var visual = wheelGo.AddComponent<WheelVisual>();
            AssignReference(visual, "wheelCollider", wc);
            AssignReference(visual, "wheelMesh", meshRoot.transform);

            return wc;
        }

        private static GameObject Box(Transform parent, string name, Vector3 pos, Vector3 scale, Material mat, bool keepCollider = false)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            if (!keepCollider) RemoveCollider(go);
            go.transform.SetParent(parent);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        private static void RemoveCollider(GameObject go)
        {
            var col = go.GetComponent<Collider>();
            if (col != null) Object.DestroyImmediate(col);
        }

        private static Color ParseColor(string hex, Color fallback)
        {
            return ColorUtility.TryParseHtmlString(hex, out var c) ? c : fallback;
        }

        private static Material MakeMat(string name, Color color, float metallic, float smoothness, Color? emission = null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            string path = $"Assets/Materials/{name}.mat";
            var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (mat == null)
            {
                mat = new Material(shader);
                AssetDatabase.CreateAsset(mat, path);
            }
            else
            {
                mat.shader = shader;
            }

            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", color);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
            if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", smoothness);

            if (emission.HasValue)
            {
                mat.EnableKeyword("_EMISSION");
                mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
                if (mat.HasProperty("_EmissionColor")) mat.SetColor("_EmissionColor", emission.Value);
            }

            EditorUtility.SetDirty(mat);
            return mat;
        }

        // ---------- Imported (glTF) car ----------
        private static GameObject CreateImportedCarPrefab(CarData car, GameConfig config, GameObject gltf)
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

            // Single chassis collider (kept above wheel contact so the car rides on wheels)
            var bc = root.AddComponent<BoxCollider>();
            bc.center = new Vector3(0f, 0.85f, 0f);
            bc.size = new Vector3(1.85f, 1.0f, 4.3f);

            var com = new GameObject("CenterOfMass");
            com.transform.SetParent(root.transform);
            com.transform.localPosition = new Vector3(0f, 0.15f, 0f);

            var fl = CreateWheelColliderOnly(root.transform, "WheelFL", WFL);
            var fr = CreateWheelColliderOnly(root.transform, "WheelFR", WFR);
            var rl = CreateWheelColliderOnly(root.transform, "WheelRL", WRL);
            var rr = CreateWheelColliderOnly(root.transform, "WheelRR", WRR);

            AssignReference(controller, "carData", car);
            AssignReference(controller, "input", input);
            AssignReference(controller, "centerOfMass", com.transform);
            AssignReference(controller, "frontLeft", fl);
            AssignReference(controller, "frontRight", fr);
            AssignReference(controller, "rearLeft", rl);
            AssignReference(controller, "rearRight", rr);

            // Visual: instantiate a plain copy of the imported model (baked into the prefab)
            var model = (GameObject)Object.Instantiate(gltf);
            model.name = "Visual";
            model.transform.SetParent(root.transform, false);
            model.transform.localPosition = Vector3.zero;
            model.transform.localRotation = Quaternion.identity;
            model.transform.localScale = Vector3.one;

            var flW = FindDeep(model.transform, "FrontLeftWheel");
            var frW = FindDeep(model.transform, "FrontRightWheel");
            var rW = FindDeep(model.transform, "BackWheels");

            // Auto-orient so the front of the car faces +Z (Unity forward)
            if (flW != null && frW != null && rW != null)
            {
                float frontZ = (flW.position.z + frW.position.z) * 0.5f;
                if (frontZ < rW.position.z)
                    model.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            }

            FitModel(model, 4.4f);

            var rig = root.AddComponent<ModelWheelRig>();
            var vws = new List<ModelWheelRig.VisualWheel>();
            if (flW != null) vws.Add(new ModelWheelRig.VisualWheel { collider = fl, mesh = flW, steers = true });
            if (frW != null) vws.Add(new ModelWheelRig.VisualWheel { collider = fr, mesh = frW, steers = true });
            if (rW != null) vws.Add(new ModelWheelRig.VisualWheel { collider = rl, mesh = rW, steers = false });
            rig.Configure(vws.ToArray(), Vector3.right, Vector3.up);

            var prefab = PrefabUtility.SaveAsPrefabAsset(root, CarPrefabPath);
            Object.DestroyImmediate(root);
            return prefab;
        }

        private static WheelCollider CreateWheelColliderOnly(Transform parent, string name, Vector3 localPos)
        {
            var wheelGo = new GameObject(name);
            wheelGo.transform.SetParent(parent);
            wheelGo.transform.localPosition = localPos;

            var wc = wheelGo.AddComponent<WheelCollider>();
            wc.radius = WheelRadius;
            wc.mass = 20f;
            wc.suspensionDistance = 0.2f;
            var spring = wc.suspensionSpring;
            spring.spring = 35000f;
            spring.damper = 4500f;
            spring.targetPosition = 0.5f;
            wc.suspensionSpring = spring;

            var fwd = wc.forwardFriction; fwd.stiffness = 1.6f; wc.forwardFriction = fwd;
            var side = wc.sidewaysFriction; side.stiffness = 1.8f; wc.sidewaysFriction = side;
            return wc;
        }

        private static void FitModel(GameObject model, float targetLength)
        {
            var rends = model.GetComponentsInChildren<Renderer>();
            if (rends.Length == 0) return;

            Bounds b = rends[0].bounds;
            for (int i = 1; i < rends.Length; i++) b.Encapsulate(rends[i].bounds);

            float length = Mathf.Max(b.size.x, b.size.z);
            if (length > 0.0001f)
                model.transform.localScale *= targetLength / length;

            // Re-measure after scaling, then center on X/Z and drop bottom to y = 0
            b = rends[0].bounds;
            for (int i = 1; i < rends.Length; i++) b.Encapsulate(rends[i].bounds);
            model.transform.localPosition += new Vector3(-b.center.x, -b.min.y, -b.center.z);
        }

        private static Transform FindDeep(Transform root, string contains)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
                if (t.name.IndexOf(contains, System.StringComparison.OrdinalIgnoreCase) >= 0)
                    return t;
            return null;
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

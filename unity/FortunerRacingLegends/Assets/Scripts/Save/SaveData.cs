using System;
using System.Collections.Generic;

namespace FortunerRacing.Save
{
    /// <summary>Per-car upgrade levels (0..max), serialized as a flat list.</summary>
    [Serializable]
    public class CarUpgradeState
    {
        public string carId;
        public int engine;
        public int turbo;
        public int transmission;
        public int brakes;
        public int suspension;
        public int tires;
        public int nitro;
    }

    /// <summary>A car id -> hex colour pair (JsonUtility cannot serialize dictionaries).</summary>
    [Serializable]
    public class CarColorEntry
    {
        public string carId;
        public string hex; // e.g. "#1560FF"
    }

    /// <summary>
    /// Full persistent player profile. Only plain fields, lists and serializable
    /// classes so Unity's <c>JsonUtility</c> can round-trip it reliably.
    /// </summary>
    [Serializable]
    public class SaveData
    {
        public int version = 1;

        // Economy
        public int coins = 0;
        public int diamonds = 0;
        public int bestScore = 0;

        // Garage
        public string selectedCarId = "fortuner";
        public List<string> ownedCars = new List<string> { "fortuner" };
        public List<CarColorEntry> carColors = new List<CarColorEntry>();
        public List<CarUpgradeState> upgrades = new List<CarUpgradeState>();

        // Progression
        public List<string> unlockedTracks = new List<string> { "highway" };

        // Settings
        public float masterVolume = 1f;
        public float sfxVolume = 1f;
        public bool cockpitView = false;
        public bool tiltSteering = false;

        // Live-ops
        public string lastDailyClaim = "";
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace FortunerRacing.Data
{
    /// <summary>
    /// Global tuning + content catalog. One asset referenced from the Boot scene
    /// so designers can balance the game without touching code.
    /// </summary>
    [CreateAssetMenu(fileName = "GameConfig", menuName = "Fortuner/Game Config")]
    public class GameConfig : ScriptableObject
    {
        [Header("Content catalog")]
        public List<CarData> cars = new List<CarData>();
        public List<TrackData> tracks = new List<TrackData>();
        public List<UpgradeData> upgrades = new List<UpgradeData>();

        [Header("Economy")]
        public int dailyRewardCoins = 500;
        public int dailyRewardDiamonds = 1;
        public int freeCoinsAmount = 150;
        public float freeCoinsCooldown = 30f;
        public float spinCooldown = 20f;

        [Header("Nitro")]
        public float nitroCapacity = 100f;
        public float nitroDrainPerSecond = 40f;
        public float nitroRegenPerSecond = 8f;

        [Header("AI")]
        [Range(0f, 1f)] public float aiSkill = 0.75f;
        public int opponentCount = 5;

        public CarData FindCar(string id) => cars.Find(c => c.carId == id);
        public TrackData FindTrack(string id) => tracks.Find(t => t.trackId == id);
        public UpgradeData FindUpgrade(UpgradeType type) => upgrades.Find(u => u.type == type);
    }
}

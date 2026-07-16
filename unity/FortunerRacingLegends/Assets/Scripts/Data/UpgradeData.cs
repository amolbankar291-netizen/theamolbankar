using UnityEngine;

namespace FortunerRacing.Data
{
    public enum UpgradeType
    {
        Engine,
        Turbo,
        Transmission,
        Brakes,
        Suspension,
        Tires,
        Nitro
    }

    /// <summary>
    /// Definition of a single upgradeable part: how much each level costs and
    /// how strongly it scales the related performance stat.
    /// </summary>
    [CreateAssetMenu(fileName = "UpgradeData", menuName = "Fortuner/Upgrade Data")]
    public class UpgradeData : ScriptableObject
    {
        public UpgradeType type = UpgradeType.Engine;
        public string displayName = "Engine";
        [TextArea] public string description = "Improve engine power for higher top speed.";
        public Sprite icon;

        [Min(1)] public int maxLevel = 5;
        public int baseCost = 800;
        public int costPerLevel = 700;

        [Tooltip("Multiplier added to the target stat per level, e.g. 0.05 = +5% per level.")]
        public float bonusPerLevel = 0.05f;

        public int CostForLevel(int currentLevel)
        {
            return baseCost + costPerLevel * Mathf.Clamp(currentLevel, 0, maxLevel);
        }

        /// <summary>Total multiplier for a given level (1.0 at level 0).</summary>
        public float MultiplierForLevel(int level)
        {
            return 1f + bonusPerLevel * Mathf.Clamp(level, 0, maxLevel);
        }
    }
}

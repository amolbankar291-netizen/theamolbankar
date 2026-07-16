using UnityEngine;

namespace FortunerRacing.Data
{
    /// <summary>
    /// Definition of a race track: scene to load, laps, reward and preview art.
    /// </summary>
    [CreateAssetMenu(fileName = "TrackData", menuName = "Fortuner/Track Data")]
    public class TrackData : ScriptableObject
    {
        public string trackId = "highway";
        public string displayName = "OPEN HIGHWAY";
        public string subtitle = "Full throttle";
        public Sprite preview;

        [Tooltip("Scene name (must be added to Build Settings).")]
        public string sceneName = "Track_Highway";

        [Min(1)] public int laps = 3;
        public int unlockCost = 0;
        public int coinReward = 500;
        public int diamondReward = 1;
    }
}

using UnityEngine;

namespace FortunerRacing.Data
{
    /// <summary>
    /// Design-time definition of a car: display info, price, UI stat bars and the
    /// physics tuning consumed by <c>CarController</c>. Add one asset per vehicle.
    /// </summary>
    [CreateAssetMenu(fileName = "CarData", menuName = "Fortuner/Car Data")]
    public class CarData : ScriptableObject
    {
        [Header("Identity")]
        public string carId = "fortuner";
        public string displayName = "Fortuner GX";
        public GameObject prefab;
        public Sprite thumbnail;
        public int price = 0;
        public string defaultColorHex = "#1560FF";

        [Header("UI stat bars (0..1)")]
        [Range(0, 1)] public float topSpeedStat = 0.7f;
        [Range(0, 1)] public float accelerationStat = 0.6f;
        [Range(0, 1)] public float handlingStat = 0.7f;
        [Range(0, 1)] public float brakingStat = 0.65f;
        [Range(0, 1)] public float nitroStat = 0.6f;

        [Header("Physics tuning")]
        public float maxSpeedKmh = 210f;
        public float motorTorque = 1600f;
        public float brakeTorque = 3200f;
        public float maxSteerAngle = 28f;
        public float mass = 1500f;
        [Tooltip("Extra top speed (km/h) while nitro is active.")]
        public float nitroBoostKmh = 45f;
        [Tooltip("Downforce applied per m/s of speed to keep the car planted.")]
        public float downforce = 60f;
    }
}

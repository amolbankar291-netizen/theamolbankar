using UnityEngine;

namespace FortunerRacing.Vehicle
{
    /// <summary>
    /// Abstraction over player input so the same <see cref="CarController"/>
    /// works with keyboard (editor/testing) and on-screen touch controls
    /// (mobile). UI buttons call the SetXxx methods; keyboard is read here.
    /// </summary>
    public class CarInput : MonoBehaviour
    {
        [Range(-1f, 1f)] public float Steer { get; private set; }
        [Range(0f, 1f)] public float Throttle { get; private set; }
        [Range(0f, 1f)] public float Brake { get; private set; }
        public bool Handbrake { get; private set; }
        public bool Nitro { get; private set; }

        [SerializeField] private bool readKeyboard = true;

        // Touch/UI state (set from HUD buttons)
        private float _touchSteer;
        private bool _touchThrottle;
        private bool _touchBrake;
        private bool _touchNitro;
        private bool _touchHandbrake;

        public void SetSteer(float value) => _touchSteer = Mathf.Clamp(value, -1f, 1f);
        public void SetThrottle(bool value) => _touchThrottle = value;
        public void SetBrake(bool value) => _touchBrake = value;
        public void SetNitro(bool value) => _touchNitro = value;
        public void SetHandbrake(bool value) => _touchHandbrake = value;

        private void Update()
        {
            float steer = _touchSteer;
            float throttle = _touchThrottle ? 1f : 0f;
            float brake = _touchBrake ? 1f : 0f;
            bool nitro = _touchNitro;
            bool handbrake = _touchHandbrake;

            if (readKeyboard)
            {
                steer += Input.GetAxis("Horizontal");
                if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) throttle = 1f;
                if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) brake = 1f;
                if (Input.GetKey(KeyCode.Space)) nitro = true;
                if (Input.GetKey(KeyCode.LeftShift)) handbrake = true;
            }

            Steer = Mathf.Clamp(steer, -1f, 1f);
            Throttle = Mathf.Clamp01(throttle);
            Brake = Mathf.Clamp01(brake);
            Nitro = nitro;
            Handbrake = handbrake;
        }
    }
}

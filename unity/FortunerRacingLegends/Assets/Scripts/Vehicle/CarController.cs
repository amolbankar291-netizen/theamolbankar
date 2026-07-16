using FortunerRacing.Data;
using UnityEngine;

namespace FortunerRacing.Vehicle
{
    /// <summary>
    /// WheelCollider-based vehicle controller tuned for a premium arcade feel:
    /// motor torque, braking with a simple ABS, speed-sensitive steering,
    /// nitro, gear read-out, reverse, downforce, anti-flip recovery and a
    /// self-right feature. Values come from <see cref="CarData"/> so cars share
    /// one script.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class CarController : MonoBehaviour
    {
        [Header("Data")]
        [SerializeField] private CarData carData;

        [Header("Wheels (assign FL, FR, RL, RR)")]
        [SerializeField] private WheelCollider frontLeft;
        [SerializeField] private WheelCollider frontRight;
        [SerializeField] private WheelCollider rearLeft;
        [SerializeField] private WheelCollider rearRight;

        [Header("References")]
        [SerializeField] private CarInput input;
        [SerializeField] private Transform centerOfMass;

        [Header("Tuning")]
        [SerializeField] private float steerAtSpeedFalloff = 0.5f; // less steering at high speed
        [SerializeField] private float absSlipThreshold = 0.35f;
        [SerializeField] private int gearCount = 6;

        // Runtime state (read by the HUD)
        public float SpeedKmh { get; private set; }
        public int Gear { get; private set; } = 1;
        public float Rpm { get; private set; }
        public float NitroNormalized => Mathf.Clamp01(_nitro / _nitroCapacity);
        public bool AbsActive { get; private set; }
        public bool IsReversing { get; private set; }

        private Rigidbody _rb;
        private float _nitro;
        private float _nitroCapacity = 100f;
        private float _nitroDrain = 40f;
        private float _nitroRegen = 8f;
        private float _upgTopSpeed = 1f;
        private float _upgAccel = 1f;
        private float _upgHandling = 1f;
        private float _upgBrake = 1f;
        private float _upgNitro = 1f;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody>();
            if (input == null) input = GetComponent<CarInput>();
            if (carData != null) _rb.mass = carData.mass;
            if (centerOfMass != null) _rb.centerOfMass = centerOfMass.localPosition;
            _nitro = _nitroCapacity;
        }

        /// <summary>
        /// Called by the garage/race setup to inject the config-driven nitro
        /// values and the aggregate upgrade multipliers for the chosen car.
        /// </summary>
        public void Configure(CarData data, GameConfig config,
            float topSpeedMul, float accelMul, float handlingMul, float brakeMul, float nitroMul)
        {
            carData = data;
            if (config != null)
            {
                _nitroCapacity = config.nitroCapacity;
                _nitroDrain = config.nitroDrainPerSecond;
                _nitroRegen = config.nitroRegenPerSecond;
            }
            _upgTopSpeed = topSpeedMul;
            _upgAccel = accelMul;
            _upgHandling = handlingMul;
            _upgBrake = brakeMul;
            _upgNitro = nitroMul;
            _nitro = _nitroCapacity;
            if (_rb != null) _rb.mass = carData.mass;
        }

        private void FixedUpdate()
        {
            if (carData == null || input == null) return;

            SpeedKmh = _rb.linearVelocity.magnitude * 3.6f;
            float forwardDot = Vector3.Dot(transform.forward, _rb.linearVelocity);
            IsReversing = forwardDot < -0.5f;

            HandleNitro(out bool usingNitro);
            HandleMotor(usingNitro);
            HandleSteering();
            HandleBraking();
            ApplyDownforce();
            UpdateReadouts(usingNitro);
        }

        private void HandleNitro(out bool usingNitro)
        {
            usingNitro = input.Nitro && _nitro > 0f && input.Throttle > 0.1f;
            if (usingNitro)
                _nitro = Mathf.Max(0f, _nitro - _nitroDrain * Time.fixedDeltaTime);
            else
                _nitro = Mathf.Min(_nitroCapacity, _nitro + _nitroRegen * Time.fixedDeltaTime);
        }

        private void HandleMotor(bool usingNitro)
        {
            float maxSpeed = carData.maxSpeedKmh * _upgTopSpeed
                             + (usingNitro ? carData.nitroBoostKmh * _upgNitro : 0f);

            float torque = carData.motorTorque * _upgAccel * input.Throttle;
            if (usingNitro) torque *= 1.5f;

            // Cut motor above the speed ceiling so nitro/top speed are respected.
            bool overSpeed = SpeedKmh >= maxSpeed && !IsReversing;
            float applied = overSpeed ? 0f : torque;

            // Rear-wheel drive with a little front assist for stability.
            rearLeft.motorTorque = applied;
            rearRight.motorTorque = applied;
            frontLeft.motorTorque = applied * 0.2f;
            frontRight.motorTorque = applied * 0.2f;

            // Reverse when braking from a near stop.
            if (input.Brake > 0.1f && SpeedKmh < 3f)
            {
                float rev = -carData.motorTorque * 0.5f * input.Brake;
                rearLeft.motorTorque = rev;
                rearRight.motorTorque = rev;
            }
        }

        private void HandleSteering()
        {
            // Reduce steer angle as speed rises for stability.
            float speed01 = Mathf.Clamp01(SpeedKmh / carData.maxSpeedKmh);
            float steerFactor = Mathf.Lerp(1f, steerAtSpeedFalloff, speed01);
            float angle = carData.maxSteerAngle * _upgHandling * steerFactor * input.Steer;
            frontLeft.steerAngle = angle;
            frontRight.steerAngle = angle;
        }

        private void HandleBraking()
        {
            AbsActive = false;
            float brakeInput = (input.Brake > 0.1f && !IsReversing && SpeedKmh > 3f) ? input.Brake : 0f;
            float handbrake = input.Handbrake ? 1f : 0f;

            float frontBrake = carData.brakeTorque * _upgBrake * brakeInput;
            float rearBrake = carData.brakeTorque * _upgBrake * brakeInput;

            // Simple ABS: if a wheel locks (high slip), ease its brake torque.
            frontBrake = ApplyAbs(frontLeft, frontBrake);
            frontBrake = ApplyAbs(frontRight, frontBrake);

            frontLeft.brakeTorque = frontBrake;
            frontRight.brakeTorque = frontBrake;
            rearLeft.brakeTorque = rearBrake + carData.brakeTorque * handbrake;
            rearRight.brakeTorque = rearBrake + carData.brakeTorque * handbrake;
        }

        private float ApplyAbs(WheelCollider wheel, float brake)
        {
            if (brake <= 0f) return brake;
            if (wheel.GetGroundHit(out var hit))
            {
                if (Mathf.Abs(hit.forwardSlip) > absSlipThreshold)
                {
                    AbsActive = true;
                    return brake * 0.4f;
                }
            }
            return brake;
        }

        private void ApplyDownforce()
        {
            float speed = _rb.linearVelocity.magnitude;
            _rb.AddForce(-transform.up * (carData.downforce * speed));
        }

        private void UpdateReadouts(bool usingNitro)
        {
            float speed01 = Mathf.Clamp01(SpeedKmh / Mathf.Max(1f, carData.maxSpeedKmh));
            Gear = IsReversing ? 0 : Mathf.Clamp(Mathf.FloorToInt(speed01 * gearCount) + 1, 1, gearCount);

            // Approximate RPM that dips on each "gear change" for an engine-sound cue.
            float gearSpan = 1f / gearCount;
            float within = (speed01 - (Gear - 1) * gearSpan) / gearSpan;
            Rpm = Mathf.Lerp(1200f, 7000f, Mathf.Clamp01(within));
        }

        /// <summary>Flip/recover the car if it ends up on its roof or stuck.</summary>
        public void Recover()
        {
            transform.rotation = Quaternion.Euler(0f, transform.eulerAngles.y, 0f);
            transform.position += Vector3.up * 1.2f;
            _rb.linearVelocity = Vector3.zero;
            _rb.angularVelocity = Vector3.zero;
        }
    }
}

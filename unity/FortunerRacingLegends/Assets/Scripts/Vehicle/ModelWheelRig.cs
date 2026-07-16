using UnityEngine;

namespace FortunerRacing.Vehicle
{
    /// <summary>
    /// Drives the wheel transforms of an imported model (glTF/FBX) from the
    /// physics <see cref="WheelCollider"/>s. Front wheels steer + spin, rear
    /// wheels spin. The spin/steer axes are exposed so an imported model whose
    /// wheels use a different local orientation can be corrected in the Inspector
    /// without touching code.
    /// </summary>
    public class ModelWheelRig : MonoBehaviour
    {
        [System.Serializable]
        public class VisualWheel
        {
            public WheelCollider collider;
            public Transform mesh;
            public bool steers;
        }

        [SerializeField] private VisualWheel[] wheels;

        [Tooltip("Local axle axis the wheel spins around (roll).")]
        [SerializeField] private Vector3 spinAxis = Vector3.right;

        [Tooltip("Local axis the front wheels steer around (usually up).")]
        [SerializeField] private Vector3 steerAxis = Vector3.up;

        [Tooltip("Flip if the wheels roll backwards relative to travel.")]
        [SerializeField] private bool invertSpin = false;

        private Quaternion[] _baseRot;
        private float[] _spin;

        private void Awake() => CacheBase();

        private void CacheBase()
        {
            if (wheels == null) return;
            _baseRot = new Quaternion[wheels.Length];
            _spin = new float[wheels.Length];
            for (int i = 0; i < wheels.Length; i++)
                if (wheels[i] != null && wheels[i].mesh != null)
                    _baseRot[i] = wheels[i].mesh.localRotation;
        }

        private void Update()
        {
            if (wheels == null || _baseRot == null) return;

            float sign = invertSpin ? -1f : 1f;
            for (int i = 0; i < wheels.Length; i++)
            {
                var w = wheels[i];
                if (w == null || w.collider == null || w.mesh == null) continue;

                _spin[i] += sign * w.collider.rpm / 60f * 360f * Time.deltaTime;
                _spin[i] %= 360f;

                Quaternion steer = w.steers
                    ? Quaternion.AngleAxis(w.collider.steerAngle, steerAxis)
                    : Quaternion.identity;
                Quaternion spin = Quaternion.AngleAxis(_spin[i], spinAxis);

                w.mesh.localRotation = steer * _baseRot[i] * spin;
            }
        }

        public void Configure(VisualWheel[] rig, Vector3 spin, Vector3 steer)
        {
            wheels = rig;
            spinAxis = spin;
            steerAxis = steer;
            CacheBase();
        }
    }
}

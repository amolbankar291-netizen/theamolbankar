using UnityEngine;

namespace FortunerRacing.CameraRig
{
    /// <summary>
    /// Lightweight chase camera for testing/driving before Cinemachine is wired
    /// in (Phase 4/6). Smoothly follows a target from a rear offset.
    /// </summary>
    public class SimpleChaseCamera : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 localOffset = new Vector3(0f, 2.6f, -6.2f);
        [SerializeField] private float followLerp = 12f;
        [SerializeField] private float lookLerp = 12f;
        [SerializeField] private float lookHeight = 1.2f;

        // Hard cap (metres) on how far the camera may drift from its ideal chase
        // pose. Enforced regardless of the serialized lerp values, so the camera
        // can never fall far behind even at top speed.
        private const float MaxLag = 3.5f;

        public void SetTarget(Transform newTarget) => target = newTarget;

        private void LateUpdate()
        {
            if (target == null) return;

            Vector3 desired = target.TransformPoint(localOffset);
            transform.position = Vector3.Lerp(transform.position, desired, Time.deltaTime * Mathf.Max(6f, followLerp));

            Vector3 drift = transform.position - desired;
            if (drift.sqrMagnitude > MaxLag * MaxLag)
                transform.position = desired + drift.normalized * MaxLag;

            Vector3 lookAt = target.position + Vector3.up * lookHeight;
            Quaternion rot = Quaternion.LookRotation(lookAt - transform.position);
            transform.rotation = Quaternion.Slerp(transform.rotation, rot, Time.deltaTime * Mathf.Max(6f, lookLerp));
        }
    }
}

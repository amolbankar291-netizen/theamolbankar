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
        [SerializeField] private Vector3 localOffset = new Vector3(0f, 3.2f, -7f);
        [SerializeField] private float followLerp = 6f;
        [SerializeField] private float lookLerp = 8f;
        [SerializeField] private float lookHeight = 1.2f;

        public void SetTarget(Transform newTarget) => target = newTarget;

        private void LateUpdate()
        {
            if (target == null) return;

            Vector3 desired = target.TransformPoint(localOffset);
            transform.position = Vector3.Lerp(transform.position, desired, Time.deltaTime * followLerp);

            Vector3 lookAt = target.position + Vector3.up * lookHeight;
            Quaternion rot = Quaternion.LookRotation(lookAt - transform.position);
            transform.rotation = Quaternion.Slerp(transform.rotation, rot, Time.deltaTime * lookLerp);
        }
    }
}

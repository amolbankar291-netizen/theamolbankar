using UnityEngine;

namespace FortunerRacing.Vehicle
{
    /// <summary>
    /// Syncs a wheel mesh transform to its <see cref="WheelCollider"/> pose each
    /// frame (spin + steer + suspension travel).
    /// </summary>
    public class WheelVisual : MonoBehaviour
    {
        [SerializeField] private WheelCollider wheelCollider;
        [SerializeField] private Transform wheelMesh;

        private void Reset()
        {
            wheelCollider = GetComponent<WheelCollider>();
        }

        private void LateUpdate()
        {
            if (wheelCollider == null || wheelMesh == null) return;
            wheelCollider.GetWorldPose(out var pos, out var rot);
            wheelMesh.SetPositionAndRotation(pos, rot);
        }
    }
}

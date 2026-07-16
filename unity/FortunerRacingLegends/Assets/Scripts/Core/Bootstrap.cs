using UnityEngine;

namespace FortunerRacing.Core
{
    /// <summary>
    /// Guarantees a <see cref="GameManager"/> exists no matter which scene is
    /// entered first (handy while iterating in the editor). Place a Bootstrap
    /// object in the Boot scene, or rely on the runtime hook below.
    /// </summary>
    public class Bootstrap : MonoBehaviour
    {
        [SerializeField] private GameObject gameManagerPrefab;

        private void Awake()
        {
            EnsureGameManager(gameManagerPrefab);
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void EnsureOnPlay()
        {
            // Only auto-create when nothing set it up (e.g. entering Play from a
            // gameplay scene during development).
            EnsureGameManager(null);
        }

        private static void EnsureGameManager(GameObject prefab)
        {
            if (GameManager.Instance != null) return;

            if (prefab != null)
            {
                Instantiate(prefab);
                return;
            }

            var go = new GameObject("GameManager");
            go.AddComponent<GameManager>();
        }
    }
}

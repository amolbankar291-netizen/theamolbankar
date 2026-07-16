using System.Collections.Generic;
using UnityEngine;

namespace FortunerRacing.Utils
{
    /// <summary>
    /// Generic component pool to avoid runtime Instantiate/Destroy spikes
    /// (traffic, particles, pickups). Grows on demand and reparents inactive
    /// instances under this pool for a tidy hierarchy.
    /// </summary>
    /// <typeparam name="T">A Component on the pooled prefab.</typeparam>
    public class ObjectPool<T> where T : Component
    {
        private readonly T _prefab;
        private readonly Transform _parent;
        private readonly Queue<T> _available = new();

        public ObjectPool(T prefab, int prewarm = 0, Transform parent = null)
        {
            _prefab = prefab;
            _parent = parent;
            for (int i = 0; i < prewarm; i++)
            {
                var item = CreateNew();
                item.gameObject.SetActive(false);
                _available.Enqueue(item);
            }
        }

        private T CreateNew()
        {
            return Object.Instantiate(_prefab, _parent);
        }

        public T Get(Vector3 position, Quaternion rotation)
        {
            T item = _available.Count > 0 ? _available.Dequeue() : CreateNew();
            var t = item.transform;
            t.SetPositionAndRotation(position, rotation);
            item.gameObject.SetActive(true);
            return item;
        }

        public void Release(T item)
        {
            if (item == null) return;
            item.gameObject.SetActive(false);
            if (_parent != null) item.transform.SetParent(_parent, false);
            _available.Enqueue(item);
        }
    }
}

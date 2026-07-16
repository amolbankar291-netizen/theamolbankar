using System;
using System.Collections.Generic;

namespace FortunerRacing.Core
{
    /// <summary>
    /// Minimal service locator used for cross-cutting singletons
    /// (SaveSystem, Wallet, AudioService, ...). Keeps systems testable
    /// and avoids scattering static singletons everywhere.
    /// </summary>
    public static class ServiceLocator
    {
        private static readonly Dictionary<Type, object> Services = new();

        public static void Register<T>(T service) where T : class
        {
            Services[typeof(T)] = service ?? throw new ArgumentNullException(nameof(service));
        }

        public static T Get<T>() where T : class
        {
            return Services.TryGetValue(typeof(T), out var service) ? (T)service : null;
        }

        public static bool TryGet<T>(out T service) where T : class
        {
            if (Services.TryGetValue(typeof(T), out var found))
            {
                service = (T)found;
                return true;
            }
            service = null;
            return false;
        }

        public static void Clear() => Services.Clear();
    }
}

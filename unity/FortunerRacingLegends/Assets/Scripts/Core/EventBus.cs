using System;
using System.Collections.Generic;

namespace FortunerRacing.Core
{
    /// <summary>
    /// Lightweight, allocation-friendly typed event bus. Decouples systems
    /// (UI, audio, gameplay) so they never hold hard references to each other.
    /// </summary>
    public static class EventBus
    {
        private static readonly Dictionary<Type, Delegate> Handlers = new();

        public static void Subscribe<T>(Action<T> handler)
        {
            var type = typeof(T);
            Handlers[type] = Handlers.TryGetValue(type, out var existing)
                ? Delegate.Combine(existing, handler)
                : handler;
        }

        public static void Unsubscribe<T>(Action<T> handler)
        {
            var type = typeof(T);
            if (!Handlers.TryGetValue(type, out var existing)) return;
            var updated = Delegate.Remove(existing, handler);
            if (updated == null) Handlers.Remove(type);
            else Handlers[type] = updated;
        }

        public static void Publish<T>(T message)
        {
            if (Handlers.TryGetValue(typeof(T), out var d))
                (d as Action<T>)?.Invoke(message);
        }

        public static void Clear() => Handlers.Clear();
    }

    // ----- Common event payloads -----

    public readonly struct GameStateChanged
    {
        public readonly GameState Previous;
        public readonly GameState Current;
        public GameStateChanged(GameState previous, GameState current)
        {
            Previous = previous;
            Current = current;
        }
    }

    public readonly struct CurrencyChanged
    {
        public readonly int Coins;
        public readonly int Diamonds;
        public CurrencyChanged(int coins, int diamonds)
        {
            Coins = coins;
            Diamonds = diamonds;
        }
    }
}

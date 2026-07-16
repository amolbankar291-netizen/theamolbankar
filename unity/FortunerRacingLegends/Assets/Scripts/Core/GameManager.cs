using FortunerRacing.Economy;
using FortunerRacing.Save;
using UnityEngine;

namespace FortunerRacing.Core
{
    /// <summary>
    /// Central persistent controller. Owns the game-state machine and registers
    /// the core services on boot. There is exactly one instance that survives
    /// scene loads.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public GameState State { get; private set; } = GameState.Boot;

        public SaveSystem Save { get; private set; }
        public Wallet Wallet { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
            InitializeServices();
        }

        private void InitializeServices()
        {
            Save = new SaveSystem();
            Save.Load();

            Wallet = new Wallet(Save);

            ServiceLocator.Register(Save);
            ServiceLocator.Register(Wallet);
            ServiceLocator.Register(this);

            ChangeState(GameState.MainMenu);
        }

        public void ChangeState(GameState next)
        {
            if (State == next) return;
            var previous = State;
            State = next;
            EventBus.Publish(new GameStateChanged(previous, next));
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) Save?.Save();
        }

        private void OnApplicationQuit() => Save?.Save();
    }
}

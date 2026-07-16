namespace FortunerRacing.Core
{
    /// <summary>High-level game states driven by <see cref="GameManager"/>.</summary>
    public enum GameState
    {
        Boot,
        MainMenu,
        Garage,
        Loading,
        Racing,
        Paused,
        Finished
    }
}

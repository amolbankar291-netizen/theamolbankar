using FortunerRacing.Core;
using FortunerRacing.Save;
using UnityEngine;

namespace FortunerRacing.Economy
{
    /// <summary>
    /// Single authority for coins and diamonds. Persists on every change and
    /// broadcasts <see cref="CurrencyChanged"/> so any UI can react without
    /// polling.
    /// </summary>
    public class Wallet
    {
        private readonly SaveSystem _save;

        public Wallet(SaveSystem save) => _save = save;

        public int Coins => _save.Data.coins;
        public int Diamonds => _save.Data.diamonds;

        public void AddCoins(int amount)
        {
            if (amount == 0) return;
            _save.Data.coins = Mathf.Max(0, _save.Data.coins + amount);
            Commit();
        }

        public void AddDiamonds(int amount)
        {
            if (amount == 0) return;
            _save.Data.diamonds = Mathf.Max(0, _save.Data.diamonds + amount);
            Commit();
        }

        public bool TrySpendCoins(int amount)
        {
            if (amount <= 0 || _save.Data.coins < amount) return false;
            _save.Data.coins -= amount;
            Commit();
            return true;
        }

        public bool TrySpendDiamonds(int amount)
        {
            if (amount <= 0 || _save.Data.diamonds < amount) return false;
            _save.Data.diamonds -= amount;
            Commit();
            return true;
        }

        private void Commit()
        {
            _save.Save();
            EventBus.Publish(new CurrencyChanged(Coins, Diamonds));
        }
    }
}

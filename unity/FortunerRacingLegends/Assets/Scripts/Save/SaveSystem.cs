using System.IO;
using UnityEngine;

namespace FortunerRacing.Save
{
    /// <summary>
    /// JSON persistence to <see cref="Application.persistentDataPath"/>. Robust
    /// against missing/corrupt files (always yields a valid <see cref="SaveData"/>).
    /// </summary>
    public class SaveSystem
    {
        private const string FileName = "profile.json";

        private string FilePath => Path.Combine(Application.persistentDataPath, FileName);

        public SaveData Data { get; private set; } = new SaveData();

        public void Load()
        {
            try
            {
                if (File.Exists(FilePath))
                {
                    var json = File.ReadAllText(FilePath);
                    var parsed = JsonUtility.FromJson<SaveData>(json);
                    Data = parsed ?? new SaveData();
                }
                else
                {
                    Data = new SaveData();
                    Save();
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[SaveSystem] Load failed, resetting profile: {e.Message}");
                Data = new SaveData();
            }
        }

        public void Save()
        {
            try
            {
                var json = JsonUtility.ToJson(Data, true);
                File.WriteAllText(FilePath, json);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[SaveSystem] Save failed: {e.Message}");
            }
        }

        public void ResetProfile()
        {
            Data = new SaveData();
            Save();
        }

        /// <summary>Returns (and lazily creates) the upgrade record for a car.</summary>
        public CarUpgradeState GetUpgrades(string carId)
        {
            var record = Data.upgrades.Find(u => u.carId == carId);
            if (record == null)
            {
                record = new CarUpgradeState { carId = carId };
                Data.upgrades.Add(record);
            }
            return record;
        }

        public string GetCarColor(string carId, string fallbackHex)
        {
            var entry = Data.carColors.Find(c => c.carId == carId);
            return entry != null ? entry.hex : fallbackHex;
        }

        public void SetCarColor(string carId, string hex)
        {
            var entry = Data.carColors.Find(c => c.carId == carId);
            if (entry == null)
            {
                entry = new CarColorEntry { carId = carId };
                Data.carColors.Add(entry);
            }
            entry.hex = hex;
            Save();
        }
    }
}

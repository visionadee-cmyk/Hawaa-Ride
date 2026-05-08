import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type Ringtone = 'beep' | 'chime' | 'pulse' | 'bell';

export type DriverSettings = {
  overlayEnabled: boolean;
  appearance: 'system' | 'light' | 'dark';
  restrictionsSkipped: boolean;
  ringtone: Ringtone;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  notificationVolume: number; // 0 to 1
};

const DEFAULT_SETTINGS: DriverSettings = {
  overlayEnabled: true,
  appearance: 'light',
  restrictionsSkipped: false,
  ringtone: 'beep',
  vibrationEnabled: true,
  soundEnabled: true,
  notificationVolume: 1,
};

const STORAGE_KEY = 'driver_settings_v1';

type ContextType = {
  settings: DriverSettings;
  loading: boolean;
  update: (patch: Partial<DriverSettings>) => Promise<void>;
};

const DriverSettingsContext = createContext<ContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  update: async () => {},
});

export function DriverSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DriverSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DriverSettings>;
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = async (patch: Partial<DriverSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <DriverSettingsContext.Provider value={{ settings, loading, update }}>
      {children}
    </DriverSettingsContext.Provider>
  );
}

export function useDriverSettings() {
  return useContext(DriverSettingsContext);
}

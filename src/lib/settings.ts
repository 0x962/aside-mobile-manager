import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import { DEMO_HOST } from './demo';

export type BridgeHost = { name: string; host: string };

export type Settings = {
  // Empty means unconfigured: the app shows the connect screen.
  bridgeHost: string;
  hosts: BridgeHost[];
  // Empty means auto: the paths resolve from the bridge user's home directory.
  asideBin: string;
  asideHome: string;
  account: number;
};

export const DEFAULT_SETTINGS: Settings = {
  bridgeHost: '',
  hosts: [],
  asideBin: '',
  asideHome: '',
  account: 0,
};

const KEY = 'settings.v1';

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  const s: Settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  // The demo is a mode, not a host; drop rows older builds may have saved.
  s.hosts = (s.hosts ?? []).filter((h) => h.host !== DEMO_HOST);
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export const SettingsContext = createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>({ settings: DEFAULT_SETTINGS, update: () => {} });

export const useSettings = () => useContext(SettingsContext);

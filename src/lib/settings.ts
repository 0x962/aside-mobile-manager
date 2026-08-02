import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';

export type BridgeHost = { name: string; host: string; builtIn?: boolean };

export type Settings = {
  bridgeHost: string;
  hosts: BridgeHost[];
  asideBin: string;
  asideHome: string;
  account: number;
};

export const DEFAULT_SETTINGS: Settings = {
  bridgeHost: '100.74.122.84:4720',
  hosts: [
    { name: 'Mac mini', host: '100.74.122.84:4720', builtIn: true },
    { name: 'Canary laptop', host: '100.88.168.85:4720', builtIn: true },
  ],
  asideBin: '/Users/navidkhan/.local/bin/aside',
  asideHome: '/Users/navidkhan/.aside',
  account: 0,
};

const KEY = 'settings.v1';

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  const s: Settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  // Built-in hosts always appear, ahead of saved custom hosts.
  const custom = (s.hosts ?? []).filter((h) => !h.builtIn);
  s.hosts = [...DEFAULT_SETTINGS.hosts, ...custom];
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

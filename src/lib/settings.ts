import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import { DEMO_HOST } from './demo';

export type BridgeHost = { name: string; host: string; builtIn?: boolean };

export type Settings = {
  bridgeHost: string;
  hosts: BridgeHost[];
  // Empty means auto: the paths resolve from the bridge user's home directory.
  asideBin: string;
  asideHome: string;
  account: number;
};

// A fresh install starts in demo mode; a phone without the tailnet cannot
// reach any real bridge, and the demo shows the whole app instead of a spinner.
export const DEFAULT_SETTINGS: Settings = {
  bridgeHost: DEMO_HOST,
  hosts: [{ name: 'Demo', host: DEMO_HOST, builtIn: true }],
  asideBin: '',
  asideHome: '',
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

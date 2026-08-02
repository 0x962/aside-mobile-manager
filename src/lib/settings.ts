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
  introSeen: boolean;
  // Pairing tokens the hosts issued, keyed by "ip:port".
  tokens: Record<string, string>;
};

export const DEFAULT_SETTINGS: Settings = {
  bridgeHost: '',
  // The scan needs one reachable bridge as its way into the network, so dev
  // builds seed the developer's machines. Release builds start empty.
  hosts: __DEV__
    ? [
        { name: 'Mac mini', host: '100.74.122.84:4720' },
        { name: 'Canary laptop', host: '100.88.168.85:4720' },
      ]
    : [],
  asideBin: '',
  asideHome: '',
  account: 0,
  introSeen: false,
  tokens: {},
};

const KEY = 'settings.v1';

// The demo is a mode, not a host, and the second row is the fictional machine
// the demo bridge reported to scans in older builds.
const BOGUS_HOSTS = new Set([DEMO_HOST, '100.101.102.103:4720']);

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  const s: Settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  s.hosts = (s.hosts ?? []).filter((h) => !BOGUS_HOSTS.has(h.host));
  s.tokens = s.tokens ?? {};
  // Scan seeds must survive resets and upgrades: keep the active host listed,
  // and always fold the defaults back in.
  if (s.bridgeHost && s.bridgeHost !== DEMO_HOST && !s.hosts.some((h) => h.host === s.bridgeHost)) {
    s.hosts = [{ name: s.bridgeHost.split(':')[0], host: s.bridgeHost }, ...s.hosts];
  }
  for (const d of DEFAULT_SETTINGS.hosts) {
    if (!s.hosts.some((h) => h.host === d.host)) s.hosts.push(d);
  }
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

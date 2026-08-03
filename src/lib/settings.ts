import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import { DEMO_HOST } from './demo';

/**
 * A computer this phone has paired with. A pairing code carries every address
 * the computer answers on, so the app can follow it between networks: the
 * local address at home, the overlay address away.
 */
export type Computer = {
  name: string;
  addresses: string[];
  token: string;
};

export type Settings = {
  // The address in use. Empty means unconfigured; DEMO_HOST means demo mode.
  bridgeHost: string;
  computers: Computer[];
  // Empty means auto: the paths resolve from the bridge user's home directory.
  asideBin: string;
  asideHome: string;
  account: number;
  introSeen: boolean;
  // Off until the phone has a push token and a computer has accepted it.
  notifyOnFinish: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  bridgeHost: '',
  computers: [],
  asideBin: '',
  asideHome: '',
  account: 0,
  introSeen: false,
  notifyOnFinish: false,
};

const KEY = 'settings.v1';

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  const s: Settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  s.computers = (s.computers ?? []).filter((c) => c.addresses?.length && c.token);
  if (s.bridgeHost !== DEMO_HOST && !computerFor(s, s.bridgeHost)) s.bridgeHost = '';
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

/** The computer that owns an address, if this phone has paired with it. */
export function computerFor(s: Settings, host: string): Computer | undefined {
  return s.computers.find((c) => c.addresses.includes(host));
}

export function tokenFor(s: Settings, host: string): string {
  return computerFor(s, host)?.token ?? '';
}

/** Addresses to try for the computer in use, the one that worked last first. */
export function addressesFor(s: Settings, host: string): string[] {
  const computer = computerFor(s, host);
  if (!computer) return host ? [host] : [];
  return [host, ...computer.addresses.filter((a) => a !== host)];
}

/** Record a pairing, replacing any earlier one for the same computer. */
export function withPairing(
  s: Settings,
  pairing: { name: string; addresses: string[]; token: string; connected: string },
): Partial<Settings> {
  const others = s.computers.filter(
    (c) => c.name !== pairing.name && !c.addresses.some((a) => pairing.addresses.includes(a)),
  );
  return {
    computers: [{ name: pairing.name, addresses: pairing.addresses, token: pairing.token }, ...others],
    bridgeHost: pairing.connected,
  };
}

export const SettingsContext = createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>({ settings: DEFAULT_SETTINGS, update: () => {} });

export const useSettings = () => useContext(SettingsContext);

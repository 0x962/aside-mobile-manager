import * as Network from 'expo-network';
import { Bridge } from './bridge';
import { DEMO_HOST } from './demo';

export type FoundHost = {
  name: string;
  host: string; // ip:port
  os: string;
  online: boolean;
  hasBridge: boolean;
};

const OVERLAY_STATUS =
  'tailscale status --json 2>/dev/null || /Applications/Tailscale.app/Contents/MacOS/Tailscale status --json';

export const BRIDGE_PORT = 4720;

export type NetworkInfo = { name: string; deviceName: string; ip: string };

// The overlay network answers on 100.100.100.100 when its tunnel is up. It
// lists no peers; it only proves membership and names the network.
export async function overlayInfo(timeoutMs = 2000): Promise<NetworkInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('http://100.100.100.100/api/data', { signal: ctrl.signal });
    const body = await res.json();
    if (!body.TailnetName) return null;
    return { name: body.TailnetName, deviceName: body.DeviceName ?? '', ip: body.IPv4 ?? '' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function probe(host: string, timeoutMs = 2500): Promise<boolean> {
  if (host === DEMO_HOST) return true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${host}/health`, { signal: ctrl.signal });
    const body = await res.json();
    return body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Find a bridge that answers, in the given order. */
export async function reachableBridge(hosts: string[]): Promise<Bridge | null> {
  for (const host of hosts) {
    if (await probe(host)) return new Bridge(host);
  }
  return null;
}

/**
 * Ask a swept bridge who it is: its hostname for the list, and its address on
 * the overlay network so the same machine found both ways collapses to one row.
 */
async function identify(host: string): Promise<{ name: string; overlayIp: string }> {
  const fallback = host.split(':')[0];
  try {
    const out = await new Bridge(host).out(
      ['sh', '-c', 'hostname -s; tailscale ip -4 2>/dev/null || /Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null'],
      { timeoutMs: 5000 },
    );
    const [name, overlayIp] = out.trim().split('\n');
    return { name: name?.trim() || fallback, overlayIp: overlayIp?.trim() ?? '' };
  } catch {
    return { name: fallback, overlayIp: '' };
  }
}

/**
 * Probe every address on this phone's own /24 subnet. This finds bridges with
 * no prior knowledge, which the overlay listing cannot do: its address range
 * is a /10, far too large to sweep.
 */
export async function sweepLan(
  port = BRIDGE_PORT,
  onProgress?: (done: number, total: number) => void,
): Promise<(FoundHost & { overlayIp: string })[]> {
  const ip = await Network.getIpAddressAsync().catch(() => null);
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return [];
  const prefix = ip.split('.').slice(0, 3).join('.');
  const targets = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`).filter((a) => a !== ip);

  const hits: string[] = [];
  let done = 0;
  // 32 at a time with a short timeout: a bridge on the same subnet answers in
  // milliseconds, and the batch keeps the phone from dropping its own requests.
  const BATCH = 32;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((a) => probe(`${a}:${port}`, 900)));
    results.forEach((ok, k) => ok && hits.push(batch[k]));
    done += batch.length;
    onProgress?.(done, targets.length);
  }

  return Promise.all(
    hits.map(async (a) => {
      const id = await identify(`${a}:${port}`);
      return {
        name: id.name,
        overlayIp: id.overlayIp,
        host: `${a}:${port}`,
        os: '',
        online: true,
        hasBridge: true,
      };
    }),
  );
}

/** List machines the overlay network knows about, then probe each for a bridge. */
export async function scanOverlay(via: Bridge, port = BRIDGE_PORT): Promise<FoundHost[]> {
  const out = await via.out(['sh', '-c', OVERLAY_STATUS]);
  const status = JSON.parse(out);
  const nodes: any[] = [status.Self, ...Object.values(status.Peer ?? {})].filter(Boolean);
  const machines = nodes
    .map((n) => ({
      name: (n.HostName as string) ?? 'unknown',
      ip: (n.TailscaleIPs as string[] | undefined)?.find((ip) => !ip.includes(':')),
      os: (n.OS as string) ?? '',
      online: n === status.Self || n.Online === true,
    }))
    .filter((m) => m.ip && !['iOS', 'android'].includes(m.os));

  return Promise.all(
    machines.map(async (m) => ({
      name: m.name,
      host: `${m.ip}:${port}`,
      os: m.os,
      online: m.online,
      hasBridge: m.online ? await probe(`${m.ip}:${port}`) : false,
    })),
  );
}

/**
 * Find every reachable bridge. The LAN sweep needs nothing to start; once any
 * bridge answers, it also lists the machines on the overlay network. Results
 * merge by address, and a machine reachable both ways keeps its overlay entry.
 */
export async function scanAll(
  seeds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<FoundHost[]> {
  const lan = await sweepLan(BRIDGE_PORT, onProgress);
  const via = await reachableBridge([...lan.map((h) => h.host), ...seeds]);
  const overlay = via ? await scanOverlay(via).catch(() => []) : [];

  // A machine found both ways appears twice under different addresses and
  // names; its own overlay address is what identifies it across the two lists.
  const overlayIps = new Set(overlay.map((h) => h.host.split(':')[0]));
  const merged: FoundHost[] = [
    ...overlay,
    ...lan.filter((h) => !h.overlayIp || !overlayIps.has(h.overlayIp)).map(({ overlayIp, ...h }) => h),
  ];

  const byHost = new Map<string, FoundHost>();
  for (const h of merged) if (!byHost.has(h.host)) byHost.set(h.host, h);
  return [...byHost.values()].sort(
    (a, b) => Number(b.hasBridge) - Number(a.hasBridge) || a.name.localeCompare(b.name),
  );
}

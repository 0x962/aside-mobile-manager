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
export async function reachableBridge(
  hosts: string[],
  tokens: Record<string, string> = {},
): Promise<Bridge | null> {
  for (const host of hosts) {
    if (await probe(host)) return new Bridge(host, tokens[host] ?? '');
  }
  return null;
}

/**
 * Ask a bridge who it is. /health needs no token, so a machine gets its real
 * name in the list before the phone has paired with it.
 */
async function identify(host: string): Promise<{ name: string; overlayIp: string; reachable: boolean }> {
  const fallback = host.split(':')[0];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`http://${host}/health`, { signal: ctrl.signal });
    const h = await res.json();
    if (h?.ok !== true) return { name: fallback, overlayIp: '', reachable: false };
    return { name: h.host || fallback, overlayIp: h.overlayIp ?? '', reachable: true };
  } catch {
    return { name: fallback, overlayIp: '', reachable: false };
  } finally {
    clearTimeout(timer);
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
  // With a VPN up the phone reports its overlay address. Those live across a
  // /10, so sweeping this /24 would find nothing; known hosts cover that case.
  const [a, b] = ip.split('.').map(Number);
  if (a === 100 && b >= 64 && b <= 127) return [];
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
  tokens: Record<string, string> = {},
  onProgress?: (done: number, total: number) => void,
): Promise<FoundHost[]> {
  // Known hosts are checked directly, whatever the sweep does: the phone may
  // sit on another subnet, or reach a machine only over the overlay network.
  const known = (
    await Promise.all(
      [...new Set(seeds)].filter((h) => h && h !== DEMO_HOST).map(async (host) => {
        const id = await identify(host);
        return id.reachable
          ? { name: id.name, overlayIp: id.overlayIp, host, os: '', online: true, hasBridge: true }
          : null;
      }),
    )
  ).filter(Boolean) as (FoundHost & { overlayIp: string })[];

  const lan = await sweepLan(BRIDGE_PORT, onProgress);

  // One machine can answer at several addresses. It reports the same overlay
  // address on each, so that is what collapses them; the overlay address wins
  // because it keeps working away from this network.
  const byMachine = new Map<string, FoundHost & { overlayIp: string }>();
  for (const h of [...known, ...lan]) {
    const key = h.overlayIp || h.host;
    const kept = byMachine.get(key);
    const isOverlayAddress = h.host.split(':')[0] === h.overlayIp;
    if (!kept || isOverlayAddress) byMachine.set(key, h);
  }
  const reachable = [...byMachine.values()];

  // Listing the wider network runs a command, so it needs a paired bridge.
  // Without one, the machines found above still stand on their own.
  const via = await reachableBridge(
    reachable.map((h) => h.host).filter((h) => tokens[h]),
    tokens,
  );
  const overlay = via ? await scanOverlay(via).catch(() => []) : [];

  // A machine found both ways appears twice under different addresses and
  // names; its own overlay address is what identifies it across the two lists.
  const overlayIps = new Set(overlay.map((h) => h.host.split(':')[0]));
  const merged: FoundHost[] = [
    ...overlay,
    ...reachable
      .filter((h) => !h.overlayIp || !overlayIps.has(h.overlayIp))
      .map(({ overlayIp, ...h }) => h),
  ];

  const byHost = new Map<string, FoundHost>();
  for (const h of merged) if (!byHost.has(h.host)) byHost.set(h.host, h);
  return [...byHost.values()].sort(
    (a, b) => Number(b.hasBridge) - Number(a.hasBridge) || a.name.localeCompare(b.name),
  );
}

import { Bridge } from './bridge';
import { DEMO_HOST } from './demo';

export type TailnetHost = {
  name: string;
  host: string; // ip:port
  os: string;
  online: boolean;
  hasBridge: boolean;
};

const TAILSCALE_STATUS =
  'tailscale status --json 2>/dev/null || /Applications/Tailscale.app/Contents/MacOS/Tailscale status --json';

export type TailnetInfo = { tailnet: string; deviceName: string; ip: string };

// Tailscale serves the local device's info over plain HTTP at 100.100.100.100
// when the tunnel is up. It lists no peers; it only proves tailnet membership.
export async function tailnetInfo(timeoutMs = 2000): Promise<TailnetInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('http://100.100.100.100/api/data', { signal: ctrl.signal });
    const body = await res.json();
    if (!body.TailnetName) return null;
    return { tailnet: body.TailnetName, deviceName: body.DeviceName ?? '', ip: body.IPv4 ?? '' };
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

/** Find a bridge that answers, starting with the selected host. */
export async function reachableBridge(hosts: string[]): Promise<Bridge | null> {
  for (const host of hosts) {
    if (await probe(host)) return new Bridge(host);
  }
  return null;
}

/** List tailnet machines via a reachable bridge, then probe each for a bridge. */
export async function scanTailnet(via: Bridge, port = 4720): Promise<TailnetHost[]> {
  const out = await via.out(['sh', '-c', TAILSCALE_STATUS]);
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

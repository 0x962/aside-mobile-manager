import { Bridge } from './bridge';
import { DEMO_HOST } from './demo';

export const BRIDGE_PORT = 4720;

/** Does a bridge answer at this address? */
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

/**
 * A computer answers on several addresses, and which one works depends on
 * where the phone is: the local address at home, the overlay address away.
 * Try them in order and report the first that answers.
 */
export async function firstReachable(addresses: string[], timeoutMs = 2500): Promise<string | null> {
  for (const address of addresses) {
    if (await probe(address, timeoutMs)) return address;
  }
  return null;
}

/** Ask an address who it is. /health needs no token. */
export async function identify(
  host: string,
): Promise<{ name: string; overlayIp: string; paired: boolean } | null> {
  try {
    const h = await new Bridge(host).health();
    if (h.ok !== true) return null;
    return {
      name: h.host ?? host.split(':')[0],
      overlayIp: h.overlayIp ?? '',
      paired: h.paired === true,
    };
  } catch {
    return null;
  }
}

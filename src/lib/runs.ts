import { useSyncExternalStore } from 'react';
import type { Aside, ModelOption } from './aside';

// One entry per in-flight `aside` turn. Lives at module level so navigation
// and screen remounts never drop a running turn.
export type Run = {
  key: string; // sessionId, or a temp key for a brand-new session
  procId: string;
  sessionId: string | null;
  text: string;
  model: ModelOption | null;
  effort: string | null;
  ticker: string;
  running: boolean;
  exitCode: number | null;
  error: string | null;
  viaWarm: boolean;
  close: () => void;
};

const runs = new Map<string, Run>();
const listeners = new Set<() => void>();
let snapshot: Run[] = [];

function notify() {
  snapshot = [...runs.values()];
  for (const l of listeners) l();
}

export function useRuns(): Run[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]|\r/g;

function tickerFrom(buffer: string): string {
  const lines = buffer.replace(ANSI, '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || line.startsWith('Aside CLI') || line.includes('aside --update')) continue;
    if (line === '>' || line.startsWith('Worked for')) continue;
    return line.length > 140 ? line.slice(0, 140) + '…' : line;
  }
  return 'Starting…';
}

function endRun(key: string, error: string | null) {
  const run = runs.get(key);
  if (!run) return;
  run.running = false;
  run.exitCode = error ? 1 : 0;
  run.error = error;
  setTimeout(() => {
    runs.delete(key);
    notify();
  }, 6000);
  notify();
}

// ---------------------------------------------------------------------------
// Warm pool: one idle interactive CLI process per open session. Booting a CLI
// process costs ~2s; keeping it at its prompt moves that cost off the send.
// ---------------------------------------------------------------------------

// The CLI redraws its input prompt with this sequence when idle and after
// each completed turn.
const PROMPT = '\x1b[0J> ';
const WARM_LIMIT = 3;

type Warm = {
  sessionId: string;
  procId: string;
  state: 'booting' | 'ready' | 'busy';
  raw: string;
  scanFrom: number;
  sinceSend: string;
  queue: string[];
  io: { close: () => void; write: (text: string) => void; kill: (signal?: string) => void } | null;
  lastUsed: number;
};

const warmPool = new Map<string, Warm>();

function newPrompts(w: Warm, chunk: string): boolean {
  w.raw += chunk;
  const found = w.raw.indexOf(PROMPT, w.scanFrom) !== -1;
  if (found) w.scanFrom = w.raw.length;
  else w.scanFrom = Math.max(0, w.raw.length - PROMPT.length);
  return found;
}

export function ensureWarm(aside: Aside, sessionId: string) {
  if (warmPool.has(sessionId)) {
    warmPool.get(sessionId)!.lastUsed = Date.now();
    return;
  }
  const w: Warm = {
    sessionId,
    procId: '',
    state: 'booting',
    raw: '',
    scanFrom: 0,
    sinceSend: '',
    queue: [],
    io: null,
    lastUsed: Date.now(),
  };
  warmPool.set(sessionId, w);
  evictIdleWarm();

  const argv = [aside.bin, '--session', sessionId, '--account', String(aside.account)];
  // A page reload or app restart orphans warm processes on the bridge; adopt
  // a matching one instead of stacking duplicates.
  aside.bridge
    .procs()
    .then(async (procs) => {
      const existing = procs.filter((p) => p.running && JSON.stringify(p.argv) === JSON.stringify(argv));
      for (const extra of existing.slice(1)) aside.bridge.kill(extra.id);
      return existing[0] ?? aside.bridge.spawn(argv);
    })
    .then((proc) => {
      w.procId = proc.id;
      w.io = aside.bridge.attach(
        proc.id,
        (ev) => {
          if (ev.type === 'data') {
            const promptSeen = newPrompts(w, ev.text);
            if (w.state === 'busy') {
              w.sinceSend += ev.text;
              const run = runs.get(sessionId);
              if (run?.running) {
                run.ticker = tickerFrom(w.sinceSend);
                notify();
              }
            }
            if (promptSeen) {
              if (w.state === 'busy') endRun(sessionId, null);
              w.state = 'ready';
              flushWarmQueue(w);
            }
          }
          if (ev.type === 'exit') {
            warmPool.delete(sessionId);
            if (w.state === 'busy') endRun(sessionId, 'session process exited');
          }
        },
        () => {
          warmPool.delete(sessionId);
          if (w.state === 'busy') endRun(sessionId, 'bridge stream lost');
        },
      );
    })
    .catch(() => warmPool.delete(sessionId));
}

function flushWarmQueue(w: Warm) {
  const text = w.queue.shift();
  if (text === undefined) return;
  w.state = 'busy';
  w.sinceSend = '';
  w.io?.write(text + '\r');
}

function evictIdleWarm() {
  const idle = [...warmPool.values()]
    .filter((w) => w.state !== 'busy')
    .sort((a, b) => a.lastUsed - b.lastUsed);
  while (warmPool.size > WARM_LIMIT && idle.length) {
    const w = idle.shift()!;
    w.io?.kill();
    w.io?.close();
    warmPool.delete(w.sessionId);
  }
}

// ---------------------------------------------------------------------------

export async function startRun(
  aside: Aside,
  opts: { sessionId: string | null; text: string; model?: ModelOption | null; effort?: string | null },
): Promise<Run> {
  // Interactive stdin submits on carriage return, so only single-line
  // messages can ride the warm process.
  const w = opts.sessionId ? warmPool.get(opts.sessionId) : undefined;
  if (opts.sessionId && w && !opts.text.includes('\n') && w.state !== 'busy') {
    w.lastUsed = Date.now();
    const run: Run = {
      key: opts.sessionId,
      procId: w.procId,
      sessionId: opts.sessionId,
      text: opts.text,
      model: opts.model ?? null,
      effort: opts.effort ?? null,
      ticker: 'Starting…',
      running: true,
      exitCode: null,
      error: null,
      viaWarm: true,
      close: () => {},
    };
    runs.set(opts.sessionId, run);
    notify();
    w.queue.push(opts.text);
    if (w.state === 'ready') flushWarmQueue(w);
    return run;
  }

  const preNewest = opts.sessionId ? null : await aside.newestSessionId();
  const proc = opts.sessionId
    ? await aside.sendMessage(opts.sessionId, opts.text, opts.model, opts.effort)
    : await aside.startSession(opts.text, opts.model, opts.effort);

  const key = opts.sessionId ?? `new-${proc.id}`;
  let buffer = '';
  const close = aside.bridge.watch(
    proc.id,
    (ev) => {
      const run = runs.get(key);
      if (!run) return;
      if (ev.type === 'data') {
        buffer += ev.text;
        run.ticker = tickerFrom(buffer);
        notify();
      }
      if (ev.type === 'exit') {
        endRun(key, ev.code !== 0 ? tickerFrom(buffer) : null);
      }
    },
    () => {
      const run = runs.get(key);
      if (run) {
        run.error = 'bridge stream lost';
        notify();
      }
    },
  );

  const run: Run = {
    key,
    procId: proc.id,
    sessionId: opts.sessionId,
    text: opts.text,
    model: opts.model ?? null,
    effort: opts.effort ?? null,
    ticker: 'Starting…',
    running: true,
    exitCode: null,
    error: null,
    viaWarm: false,
    close,
  };
  runs.set(key, run);
  notify();

  // A fresh session gets its id from the database once the CLI registers it.
  // Keep polling briefly after exit: short turns can finish before the poll.
  if (!opts.sessionId) {
    let attempts = 0;
    const poll = setInterval(async () => {
      const current = runs.get(key);
      if (!current || attempts++ > 30) return clearInterval(poll);
      const newest = await aside.newestSessionId().catch(() => null);
      if (newest && newest !== preNewest) {
        current.sessionId = newest;
        clearInterval(poll);
        notify();
      }
    }, 800);
  }
  return run;
}

export async function stopRun(aside: Aside, run: Run) {
  if (run.viaWarm && run.sessionId) {
    warmPool.get(run.sessionId)?.io?.write('\x03');
    return;
  }
  await aside.bridge.kill(run.procId);
}

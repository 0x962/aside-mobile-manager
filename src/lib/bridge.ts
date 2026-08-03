import { b64ToUtf8, utf8ToB64 } from './base64';

export type RunResult = {
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
};

export type ProcSummary = {
  id: string;
  argv: string[];
  startedAt: number;
  exitedAt: number | null;
  exitCode: number | null;
  running: boolean;
};

export type ProcEvent =
  | { type: 'data'; text: string }
  | { type: 'exit'; code: number | null };

export type Health = {
  ok: boolean;
  procs: number;
  host?: string;
  overlayIp?: string;
  authRequired?: boolean;
  paired?: boolean;
};

export class Bridge {
  constructor(
    public host: string,
    public token = '',
  ) {}

  private url(path: string) {
    return `http://${this.host}${path}`;
  }

  private get headers(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {};
  }

  async health(): Promise<Health> {
    const res = await fetch(this.url('/health'), { headers: this.headers });
    return res.json();
  }

  /** Ask the host to show a pairing QR code on its own screen. */
  async requestPairing(label: string): Promise<void> {
    const res = await fetch(this.url('/pair'), {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
    if (!res.ok) throw new Error(`the bridge refused to start pairing (${res.status})`);
  }

  /** Ask this computer to wake the phone when a turn finishes. */
  async registerDevice(pushToken: string): Promise<void> {
    const res = await fetch(this.url('/devices'), {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ pushToken, platform: 'ios' }),
    });
    if (!res.ok) throw new Error(`the bridge refused the device (${res.status})`);
  }

  /** Turn a scanned code into a lasting token. */
  async claimPairing(token: string): Promise<string> {
    const res = await fetch(this.url('/pair/claim'), {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error ?? 'that code was not accepted');
    return body.host ?? '';
  }

  async run(argv: string[], opts?: { stdin?: string; timeoutMs?: number; cwd?: string }): Promise<RunResult> {
    const res = await fetch(this.url('/run'), {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        argv,
        cwd: opts?.cwd,
        timeoutMs: opts?.timeoutMs,
        stdinB64: opts?.stdin !== undefined ? utf8ToB64(opts.stdin) : undefined,
      }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error);
    return {
      code: body.code,
      signal: body.signal,
      timedOut: body.timedOut,
      stdout: b64ToUtf8(body.stdoutB64),
      stderr: b64ToUtf8(body.stderrB64),
    };
  }

  /** Run argv and return stdout; throws when the exit code is not zero. */
  async out(argv: string[], opts?: { stdin?: string; timeoutMs?: number }): Promise<string> {
    const r = await this.run(argv, opts);
    if (r.code !== 0) throw new Error(`${argv[0]} exited ${r.code}: ${r.stderr.slice(0, 400)}`);
    return r.stdout;
  }

  async spawn(argv: string[], opts?: { cwd?: string }): Promise<ProcSummary> {
    const res = await fetch(this.url('/procs'), {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ argv, cwd: opts?.cwd }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error);
    return body;
  }

  async procs(): Promise<ProcSummary[]> {
    const res = await fetch(this.url('/procs'), { headers: this.headers });
    return (await res.json()).procs;
  }

  async proc(id: string): Promise<ProcSummary & { output: string }> {
    const res = await fetch(this.url(`/procs/${id}`), { headers: this.headers });
    const body = await res.json();
    if (body.error) throw new Error(body.error);
    return { ...body, output: b64ToUtf8(body.outputB64) };
  }

  async kill(id: string, signal = 'SIGTERM'): Promise<void> {
    await fetch(this.url(`/procs/${id}?signal=${signal}`), { method: 'DELETE', headers: this.headers });
  }

  /** Stream a process with stdin access. */
  attach(
    id: string,
    onEvent: (ev: ProcEvent) => void,
    onError?: (err: unknown) => void,
  ): { close: () => void; write: (text: string) => void; kill: (signal?: string) => void } {
    const auth = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    const ws = new WebSocket(`ws://${this.host}/procs/${id}/io${auth}`);
    const outbox: string[] = [];
    ws.onopen = () => {
      while (outbox.length) ws.send(outbox.shift()!);
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === 'data' || msg.type === 'history') onEvent({ type: 'data', text: b64ToUtf8(msg.dataB64) });
      if (msg.type === 'exit') onEvent({ type: 'exit', code: msg.code });
    };
    ws.onerror = (err) => onError?.(err);
    const send = (payload: object) => {
      const raw = JSON.stringify(payload);
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      else outbox.push(raw);
    };
    return {
      close: () => ws.close(),
      write: (text) => send({ type: 'stdin', dataB64: utf8ToB64(text) }),
      kill: (signal = 'SIGTERM') => send({ type: 'kill', signal }),
    };
  }

  /** Stream a process. Returns a close function. */
  watch(id: string, onEvent: (ev: ProcEvent) => void, onError?: (err: unknown) => void): () => void {
    return this.attach(id, onEvent, onError).close;
  }
}

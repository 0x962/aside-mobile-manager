// minibridge: run commands on this machine from apps on the local network.
// HTTP for control, WebSocket for process I/O. No auth: network membership is
// the boundary — loopback, the CGNAT overlay range, and private LAN ranges.
// Anyone on those networks can run commands here; keep them trusted.
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);
const pty = require('node-pty');

const PORT = Number(process.env.MINIBRIDGE_PORT ?? 4720);
const MAX_BUFFER = 4 * 1024 * 1024; // per-process scrollback kept for late-joining clients
const KEEP_EXITED_MS = 60 * 60 * 1000;
const RUN_TIMEOUT_MS = 120 * 1000;

function bindable(octets) {
  const [a, b] = octets;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT overlay (Tailscale)
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function listenHosts() {
  if (process.env.MINIBRIDGE_HOSTS) return process.env.MINIBRIDGE_HOSTS.split(',');
  const hosts = ['127.0.0.1'];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4') continue;
      if (bindable(a.address.split('.').map(Number))) hosts.push(a.address);
    }
  }
  return hosts;
}

// ---------------------------------------------------------------------------
// Process registry
// ---------------------------------------------------------------------------

const procs = new Map();

function trimBuffer(p) {
  while (p.bufferSize > MAX_BUFFER && p.buffer.length > 1) {
    p.bufferSize -= p.buffer[0].length;
    p.buffer.shift();
  }
}

function createProc({ argv, cwd, env, cols, rows }) {
  const id = crypto.randomBytes(8).toString('hex');
  const term = pty.spawn(argv[0], argv.slice(1), {
    name: 'xterm-256color',
    cols: cols ?? 100,
    rows: rows ?? 40,
    cwd: cwd ?? process.env.HOME,
    env: { ...process.env, ...env },
  });
  const p = {
    id, argv, cwd: cwd ?? process.env.HOME,
    startedAt: Date.now(), exitedAt: null, exitCode: null,
    term, buffer: [], bufferSize: 0, sockets: new Set(),
  };
  term.onData((data) => {
    const chunk = Buffer.from(data, 'utf8');
    p.buffer.push(chunk);
    p.bufferSize += chunk.length;
    trimBuffer(p);
    const msg = JSON.stringify({ type: 'data', dataB64: chunk.toString('base64') });
    for (const ws of p.sockets) ws.send(msg);
  });
  term.onExit(({ exitCode, signal }) => {
    p.exitedAt = Date.now();
    p.exitCode = exitCode;
    const msg = JSON.stringify({ type: 'exit', code: exitCode, signal: signal ?? null });
    for (const ws of p.sockets) ws.send(msg);
    setTimeout(() => procs.delete(id), KEEP_EXITED_MS).unref();
  });
  procs.set(id, p);
  return p;
}

function procSummary(p) {
  return {
    id: p.id, argv: p.argv, cwd: p.cwd,
    startedAt: p.startedAt, exitedAt: p.exitedAt, exitCode: p.exitCode,
    running: p.exitedAt === null, bufferSize: p.bufferSize, clients: p.sockets.size,
  };
}

// ---------------------------------------------------------------------------
// One-shot run (no PTY): the workhorse for reads like sqlite3 / cat / ls.
// ---------------------------------------------------------------------------

function runOnce({ argv, cwd, env, stdinB64, timeoutMs }, respond) {
  const child = spawn(argv[0], argv.slice(1), {
    cwd: cwd ?? process.env.HOME,
    env: { ...process.env, ...env },
  });
  const stdout = [];
  const stderr = [];
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs ?? RUN_TIMEOUT_MS);
  child.stdout.on('data', (d) => stdout.push(d));
  child.stderr.on('data', (d) => stderr.push(d));
  child.on('error', (err) => {
    clearTimeout(timer);
    respond(500, { error: String(err) });
  });
  child.on('close', (code, signal) => {
    clearTimeout(timer);
    respond(200, {
      code, signal: signal ?? null, timedOut,
      stdoutB64: Buffer.concat(stdout).toString('base64'),
      stderrB64: Buffer.concat(stderr).toString('base64'),
    });
  });
  if (stdinB64) child.stdin.write(Buffer.from(stdinB64, 'base64'));
  child.stdin.end();
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function handle(req, res) {
  const respond = (status, obj) => {
    res.writeHead(status, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': '*',
    });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'OPTIONS') return respond(204, {});
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean);

  let body = {};
  if (req.method === 'POST') {
    const raw = await readBody(req);
    try { body = JSON.parse(raw.toString('utf8') || '{}'); }
    catch { return respond(400, { error: 'invalid JSON body' }); }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return respond(200, { ok: true, service: 'minibridge', pid: process.pid, procs: procs.size });
  }
  if (req.method === 'POST' && url.pathname === '/run') {
    if (!Array.isArray(body.argv) || body.argv.length === 0) return respond(400, { error: 'argv required' });
    return runOnce(body, respond);
  }
  if (req.method === 'POST' && url.pathname === '/procs') {
    if (!Array.isArray(body.argv) || body.argv.length === 0) return respond(400, { error: 'argv required' });
    const p = createProc(body);
    return respond(201, procSummary(p));
  }
  if (req.method === 'GET' && url.pathname === '/procs') {
    return respond(200, { procs: [...procs.values()].map(procSummary) });
  }
  if (parts[0] === 'procs' && parts.length >= 2) {
    const p = procs.get(parts[1]);
    if (!p) return respond(404, { error: 'no such process' });
    if (req.method === 'GET') {
      return respond(200, { ...procSummary(p), outputB64: Buffer.concat(p.buffer).toString('base64') });
    }
    if (req.method === 'DELETE') {
      if (p.exitedAt === null) p.term.kill(url.searchParams.get('signal') ?? 'SIGTERM');
      return respond(200, procSummary(p));
    }
  }
  respond(404, { error: 'not found' });
}

// ---------------------------------------------------------------------------
// WebSocket: /procs/:id/io
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, p) => {
  p.sockets.add(ws);
  ws.send(JSON.stringify({ type: 'history', dataB64: Buffer.concat(p.buffer).toString('base64') }));
  if (p.exitedAt !== null) ws.send(JSON.stringify({ type: 'exit', code: p.exitCode, signal: null }));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString('utf8')); } catch { return; }
    if (p.exitedAt !== null) return;
    if (msg.type === 'stdin') p.term.write(msg.dataB64 ? Buffer.from(msg.dataB64, 'base64').toString('utf8') : msg.text);
    if (msg.type === 'resize') p.term.resize(msg.cols, msg.rows);
    if (msg.type === 'kill') p.term.kill(msg.signal ?? 'SIGTERM');
  });
  ws.on('close', () => p.sockets.delete(ws));
});

function upgrade(req, socket, head) {
  const parts = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean);
  const p = parts[0] === 'procs' && parts[2] === 'io' ? procs.get(parts[1]) : null;
  if (!p) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, p));
}

for (const host of listenHosts()) {
  const server = http.createServer(handle);
  server.on('upgrade', upgrade);
  server.listen(PORT, host, () => console.log(`minibridge listening on ${host}:${PORT}`));
}

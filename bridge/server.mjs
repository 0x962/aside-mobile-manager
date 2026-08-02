// minibridge: run commands on this machine from apps on the local network.
// HTTP for control, WebSocket for process I/O. Clients hold a bearer token
// they get by pairing: the bridge shows a QR code on this machine's screen,
// so only someone sitting at it can hand out access.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);
const pty = require('node-pty');
const QRCode = require('qrcode');

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
// Pairing and tokens
//
// A token is minted only while someone at this machine can see the screen: the
// bridge renders it as a QR code and opens it in the image viewer. A pending
// token expires unused; scanning it makes it permanent.
// ---------------------------------------------------------------------------

const STATE_DIR = path.join(os.homedir(), '.minibridge');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const PAIR_WINDOW_MS = 3 * 60 * 1000;

function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).tokens ?? [];
  } catch {
    return [];
  }
}

let tokens = loadTokens();
const pending = new Map(); // token -> { expiresAt, qrPath }

function saveTokens() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ tokens }, null, 2), { mode: 0o600 });
}

function tokenOf(req, url) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return url.searchParams.get('token') ?? '';
}

/** Is this token already paired? Never promotes a pending token. */
function authorizeReadOnly(token) {
  return Boolean(token) && tokens.some((t) => t.token === token);
}

/** Accept a known token; a pending one becomes permanent on first use. */
function authorize(token) {
  if (!token) return false;
  if (tokens.some((t) => t.token === token)) return true;
  const p = pending.get(token);
  if (!p) return false;
  pending.delete(token);
  if (Date.now() > p.expiresAt) return false;
  tokens.push({ token, pairedAt: Date.now() });
  saveTokens();
  fs.rm(p.qrPath, { force: true }, () => {});
  return true;
}

async function startPairing(label) {
  const token = crypto.randomBytes(24).toString('base64url');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'minibridge-pair-'));
  const qrPath = path.join(dir, 'pair-with-this-code.png');
  await QRCode.toFile(qrPath, JSON.stringify({ v: 1, token, host: os.hostname() }), {
    width: 720,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  pending.set(token, { expiresAt: Date.now() + PAIR_WINDOW_MS, qrPath });
  setTimeout(() => {
    if (pending.delete(token)) fs.rm(qrPath, { force: true }, () => {});
  }, PAIR_WINDOW_MS).unref();
  // Show it on this machine's screen: seeing the code is the proof of access.
  spawn('open', [qrPath], { detached: true, stdio: 'ignore' }).unref();
  console.log(`pairing code shown for ${label ?? 'a device'}; expires in ${PAIR_WINDOW_MS / 1000}s`);
  return { expiresInMs: PAIR_WINDOW_MS };
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

  // Open endpoints: liveness, and asking for a pairing code. Everything else
  // needs a token.
  if (req.method === 'GET' && url.pathname === '/health') {
    return respond(200, {
      ok: true,
      service: 'minibridge',
      pid: process.pid,
      procs: procs.size,
      host: os.hostname(),
      authRequired: true,
      paired: authorizeReadOnly(tokenOf(req, url)),
    });
  }
  if (req.method === 'POST' && url.pathname === '/pair') {
    const info = await startPairing(body.label);
    return respond(200, info);
  }

  if (!authorize(tokenOf(req, url))) {
    return respond(401, { error: 'not paired', hint: 'POST /pair, then scan the code shown on the host screen' });
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
  const url = new URL(req.url, 'http://x');
  if (!authorize(tokenOf(req, url))) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const p = parts[0] === 'procs' && parts[2] === 'io' ? procs.get(parts[1]) : null;
  if (!p) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, p));
}

for (const host of listenHosts()) {
  const server = http.createServer(handle);
  server.on('upgrade', upgrade);
  server.listen(PORT, host, () => console.log(`minibridge listening on ${host}:${PORT}`));
}

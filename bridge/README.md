# minibridge

minibridge runs commands on this machine for apps on the local network. The client holds the business logic. The bridge runs argv arrays and streams I/O. The server binds loopback, the Tailscale range (100.64.0.0/10), and private LAN ranges (10/8, 192.168/16, 172.16/12).

Clients must pair before they can run anything. A client posts to `/pair`; the bridge renders a token as a QR code and opens it in the image viewer on this machine. Only a person who can see this screen can pass the token to a phone. The code expires after 3 minutes, and scanning it makes the token permanent. Tokens live in `~/.minibridge/state.json`; delete an entry to revoke a device.

## Install

```
./install.sh
```

The script installs dependencies and loads a launchd agent (`co.nvdk.minibridge`). The agent starts the bridge at login and restarts it if it dies. Logs go to `~/Library/Logs/minibridge.log`.

To run Aside at startup too:

```
./install.sh --with-aside
```

## API

Default port: 4720. Override with `MINIBRIDGE_PORT`. Override bind addresses with `MINIBRIDGE_HOSTS` (comma-separated).

- `GET /health` - liveness, process count, hostname, and whether the caller's token is paired. No token needed.
- `POST /pair` - show a pairing QR code on this machine's screen. Body: `{label?}`. Returns `{expiresInMs}`. No token needed.

Every other endpoint needs the token, as `Authorization: Bearer <token>` or `?token=` on the WebSocket.
- `POST /run` - run argv to completion. Body: `{argv, cwd?, env?, stdinB64?, timeoutMs?}`. Returns `{code, signal, timedOut, stdoutB64, stderrB64}`. Default timeout: 120 s.
- `POST /procs` - spawn argv in a PTY. Body: `{argv, cwd?, env?, cols?, rows?}`. Returns the process summary with `id`.
- `GET /procs` - list processes. Exited processes stay listed for 1 hour.
- `GET /procs/:id` - summary plus full output as `outputB64` (last 4 MB).
- `DELETE /procs/:id?signal=SIGTERM` - send a signal.
- `WS /procs/:id/io` - stream I/O. Server sends `{type: "history"|"data", dataB64}` and `{type: "exit", code, signal}`. Client sends `{type: "stdin", dataB64|text}`, `{type: "resize", cols, rows}`, `{type: "kill", signal?}`.

## Examples

Run a read:

```
curl -s localhost:4720/run -d '{"argv":["ls","-la","/tmp"]}' | jq -r .stdoutB64 | base64 -d
```

Spawn an Aside session and watch it:

```
curl -s localhost:4720/procs -d '{"argv":["/Users/navidkhan/.local/bin/aside","exec","Summarize my open tabs"]}'
websocat "ws://localhost:4720/procs/<id>/io"
```

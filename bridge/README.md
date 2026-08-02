# minibridge

minibridge runs commands on this machine for apps on the local network. The client holds the business logic. The bridge runs argv arrays and streams I/O. The server binds loopback, the Tailscale range (100.64.0.0/10), and private LAN ranges (10/8, 192.168/16, 172.16/12).

Clients must pair before they can run anything. The bridge renders a token as a QR code and opens it in the image viewer on this machine, so only a person who can see this screen passes access to a phone. The code expires after 3 minutes, and scanning it makes the token permanent.

Raise a code from this machine when the phone cannot reach it yet:

```
npm run pair
```

The code carries the addresses this machine answers on, so the phone connects with no discovery. A phone that already sees the bridge can instead ask for a code with `POST /pair`.

Tokens live in `~/.minibridge/state.json`; delete an entry to revoke a device.

## Install

With Homebrew:

```
brew install 0x962/tap/minibridge
brew services start minibridge
minibridge pair
```

Or without it, on the machine that runs Aside:

```
curl -fsSL https://raw.githubusercontent.com/0x962/aside-mobile-manager/main/bridge/install.sh | bash
```

The script installs the latest release to `~/.minibridge/bridge`, loads a launchd agent (`co.nvdk.minibridge`) that starts the bridge at login and restarts it if it dies, then shows a pairing code. Logs go to `~/Library/Logs/minibridge.log`.

Use one installer, not both. Each registers its own launchd agent on port 4720,
and the second one to start cannot bind. If Homebrew now manages the bridge and
an older curl install left an agent behind, remove it:

```
launchctl bootout gui/$(id -u)/co.nvdk.minibridge
rm ~/Library/LaunchAgents/co.nvdk.minibridge.plist
```

Node 20 or newer is required. An existing install is used when it qualifies; otherwise the script puts a private copy in `~/.minibridge/node` and touches nothing else.

Add `--with-aside` to keep Aside.app running at login too. Add `--no-agent` to install the files without loading the agent. Set `MINIBRIDGE_VERSION` to pin a release, or `MINIBRIDGE_BRANCH=main` to track the branch.

To pair another device later:

```
minibridge pair          # Homebrew
~/.minibridge/bridge/pair.sh   # curl install
```

## API

Default port: 4720. Override with `MINIBRIDGE_PORT`. Override bind addresses with `MINIBRIDGE_HOSTS` (comma-separated).

The bridge binds loopback, real network interfaces carrying a private address, and the Tailscale range. It skips virtual interfaces such as VM and container bridges, which carry private addresses but reach nothing you think of as your network. To bind one address only, for example the Tailscale one:

```
MINIBRIDGE_HOSTS=100.x.y.z minibridge serve
```

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

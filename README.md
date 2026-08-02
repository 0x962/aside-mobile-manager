# aside-mobile-manager

This repo holds a phone app for [Aside](https://aside.studio) sessions. Aside is a browser agent that runs on a Mac. Aside removed most of my personal admin. It watches my inbox. It chases my returns. It monitors my payments. It does this in my own browser, with my own logins. Aside has no mobile app yet. I could not wait for one. This app starts and steers Aside sessions from a phone.

The system has two parts:

- `bridge/` holds minibridge. This is a small Node service that runs on the Mac. It accepts commands over a Tailscale network and runs them. It has no other logic.
- The Expo app in this repo runs on the phone. The app holds all product logic. It composes `aside` CLI commands and sends them through the bridge.

## How it works

The app reads session data from the files that Aside writes:

- The session list comes from a `sqlite3` query on `state.db`.
- Transcripts come from each session's `messages.jsonl` file.
- The model list comes from `models.json`, the settings file, and past sessions.

Sends go through the `aside` CLI. The CLI starts one process per message. A process takes about two seconds to boot. The app hides that cost with a warm pool: it boots one interactive CLI process when you open a chat. Messages then go to that process over stdin. The end of a turn shows as the CLI prompt, and the process waits for the next message.

The transcript view collapses thinking and tool calls into one row per work stretch. A shimmer line shows the live state while a reply generates. Sent messages render at once, before the CLI records them.

## Run

Install the bridge on the Mac that runs Aside:

```
cd bridge && ./install.sh
```

Run the app:

```
npm install
npx expo start
```

Open the app in Expo Go on the phone. Set the bridge host in Settings to the Mac's Tailscale address, for example `100.x.y.z:4720`. The Scan button finds machines on the tailnet and probes each one for a bridge.

## Security model

The bridge runs any command that reaches it. It binds only to loopback and Tailscale addresses. Access to the tailnet is the whole boundary. Do not expose the port outside the tailnet.

## Licenses

The code is under the MIT license. The Geist fonts in `assets/fonts/` come from the official [vercel/geist-font](https://github.com/vercel/geist-font) release, under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`). This repo contains no Aside code or assets. The app talks to a licensed Aside install on your own machine through its CLI.

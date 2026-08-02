# aside-mobile-manager

This repo holds a phone app for [Aside](https://aside.studio). Aside is the first "AI browser" I've used that is actually good. I've been able to improve my life by handing off personal and work admin; Amazon returns, tax returns, bill payments, expense reports, visa applications... it is so good I cannot imagine getting through these tasks without Aside anymore. I want Aside on my phone, and I couldn't wait any longer for the team to build one. Naturally, I built one.

The system has two parts:

- `bridge/` holds minibridge. This is a small Node service meant to run next to your Aisde browser. It accepts commands over a Tailscale network and runs them. It has no other logic.
- The Expo app in this repo runs on the phone. The app holds all product logic. It composes `aside` CLI commands and sends them through the bridge.

## How it works

The app reads session data from the files that Aside writes:

- The session list comes from a `sqlite3` query on `state.db`.
- Transcripts come from each session's `messages.jsonl` file.
- The model list comes from `models.json`, the settings file, and past sessions.

Sends go through the `aside` CLI. The CLI starts one process per message. A process takes about two seconds to boot. The app maintains a warm pool of CLIs: it boots one interactive CLI process when you open a chat. Messages then go to that process over stdin. The end of a turn shows as the CLI prompt, and the process waits for the next message.

## Run

Install the bridge on the machine that runs Aside:

```
cd bridge && ./install.sh
```

Run the app:

```
npm install
npx expo start
```

Figure out network: 
Your phone needs to be able to talk to the bridge. You can use a free tailscale account like I do. 

Open the app in Expo Go on the phone. Set the bridge host in Settings to the Mac's Tailscale address, for example `100.x.y.z:4720`. The Scan button finds machines on the tailnet and probes each one for a bridge.

## Security model

The bridge runs any command that reaches it. It binds only to loopback and Tailscale addresses. Access to the tailnet is the whole boundary. Do not expose the port outside the tailnet.

## Licenses

The code is under the MIT license. The Geist fonts in `assets/fonts/` come from the official [vercel/geist-font](https://github.com/vercel/geist-font) release, under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`). This repo contains no Aside code or assets. The app talks to a licensed Aside install on your own machine through its CLI.

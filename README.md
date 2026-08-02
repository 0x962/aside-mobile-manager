# Aside Mobile App

![Unofficial](https://img.shields.io/badge/status-unofficial-orange)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![Platform: iOS](https://img.shields.io/badge/platform-iOS-lightgrey?logo=apple)
![Runs over Tailscale](https://img.shields.io/badge/network-Tailscale-4B5563)

> This is an unofficial, personal project. Aside does not build, support, or endorse it. The app drives a licensed Aside install on your own machine, through its own CLI.

This repo holds a phone app for [Aside](https://aside.com/). Aside is the first "AI browser" I've used that is actually good. I've been able to improve my life by handing off personal and work admin; Amazon returns, tax returns, bill payments, expense reports, visa applications... it is so good I cannot imagine getting through these tasks without Aside anymore. I want Aside on my phone, and I couldn't wait any longer for the team to build one. Naturally, I built one.

The system has two parts:

- `bridge/` holds minibridge. This is a small Node service meant to run next to your Aside browser. It accepts commands from paired devices on your own network and runs them. It has no other logic.
- The Expo app in this repo runs on the phone. The app holds all product logic. It composes `aside` CLI commands and sends them through the bridge.

## How it works

The app reads session data from the files that Aside writes:

- The session list comes from a `sqlite3` query on `state.db`.
- Transcripts come from each session's `messages.jsonl` file.
- The model list comes from `models.json`, the settings file, and past sessions.

Sends go through the `aside` CLI. The CLI starts one process per message. A process takes about two seconds to boot. The app maintains a warm pool of CLIs: it boots one interactive CLI process when you open a chat. Messages then go to that process over stdin. The end of a turn shows as the CLI prompt, and the process waits for the next message.

## Install the bridge

Run this on the computer that runs Aside:

```
curl -fsSL https://raw.githubusercontent.com/0x962/aside-mobile-manager/main/bridge/install.sh | bash
```

The script installs the bridge to `~/.minibridge/bridge`, keeps it running with a launchd agent, and opens a pairing code on the screen. It uses the Node you already have when it is version 20 or newer, and otherwise puts a private copy in `~/.minibridge/node`, so nothing else on the machine changes.

To also keep Aside running at login, add `--with-aside`.

## Pair the phone

Your phone reaches the bridge over your own network. Same Wi-Fi works. A free Tailscale account also works, and lets you reach the computer from anywhere.

1. On the computer, show a pairing code:

   ```
   ~/.minibridge/bridge/pair.sh
   ```

   A QR code opens on that screen. The installer does this once for you.

2. In the app, tap **Pair a computer**, then point the phone at the code.

The code carries a key and every address the computer answers on, so the phone connects with no discovery and nothing to type. It expires after 3 minutes. Run `pair.sh` again for another device, or to pair again after you forget a computer in Settings.

The app keeps all of a computer's addresses and uses whichever one answers, so it follows the computer between your local network and Tailscale. The CLI path and the Aside home resolve from the bridge user's home directory; the two path fields in Settings override this.

## Run the app

```
npm install
npx expo start
```

Open it in Expo Go on the phone.

## Demo mode

The connect screen has one secondary option: Demo. It serves sample sessions from the phone itself: the list, the transcripts, and live turns that stream thoughts and tool calls before a canned reply. No computer, bridge, or network is needed. A purple glow shows at the bottom edge while demo mode is on; tap the DEMO chip on the sessions screen to exit back to the connect screen. App Store reviewers can exercise the whole app this way.

## Security model

The bridge runs any command a paired client sends. Pairing needs sight of the computer's screen: the key appears there as a QR code and expires after 3 minutes. There is no other way in, so an attacker on your network cannot reach the bridge without that code. Keys live in `~/.minibridge/state.json` on the computer; delete an entry to revoke a device. The bridge binds loopback, the Tailscale range, and private LAN ranges. Never expose port 4720 to the internet.

## Licenses

The code is under the MIT license. The Geist fonts in `assets/fonts/` come from the official [vercel/geist-font](https://github.com/vercel/geist-font) release, under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`). This repo contains no Aside code or assets. The app talks to a licensed Aside install on your own machine through its CLI.

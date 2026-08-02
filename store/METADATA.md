# App Store Connect listing

Copy these fields into App Store Connect. The app record must be created under the
**Thera North, Inc.** team.

## App information

- **Name:** Sidecar for Aside
- **Subtitle:** Unofficial mobile client
- **Bundle ID:** `com.theranorth.sidecarforaside`
- **SKU:** `sidecar-for-aside-001`
- **Primary category:** Developer Tools
- **Secondary category:** Utilities
- **Age rating:** 4+ (no objectionable content; answer No to every questionnaire item)
- **Price:** Free
- **Availability:** All territories

## Promotional text (170 characters)

Continue your Aside sessions from your phone. Read transcripts, start work, and watch a turn run. Free, open source, and unofficial.

## Description

Sidecar is a free, open source, unofficial mobile client for Aside, the AI browser that runs on your own computer.

Aside works in a browser on your computer, with your own logins and your own tabs. Sidecar is the phone side of it. Start a session on your way out the door, read what happened while you were away, and answer a question the agent asks, without opening your laptop.

WHAT YOU CAN DO
- Read every session and its full transcript, including the steps the agent took.
- Start a new session, or reply to one already running.
- Watch a turn as it works, step by step.
- Pick the model and thinking level when you start a session.
- Switch between several computers you have paired.

HOW IT CONNECTS
Your phone talks to a small open source service called the bridge, which you install on the computer that runs Aside. Nothing passes through a server we run. There is no account, and there is nothing to sign up for.

Install the bridge with two commands on that computer:
  brew install 0x962/tap/minibridge
  brew services start minibridge

The computer then shows a pairing code on its own screen. Scan it once in the app and you are connected. Only a device that scans a code can reach the bridge, and you can revoke any device from the computer.

TRY IT FIRST
The app includes a demo with sample sessions, so you can see how everything works before you install anything.

WHAT YOU NEED
- A Mac running Aside, which you license yourself from aside.com.
- The bridge installed on that computer.
- Both devices on the same network. A private network such as Tailscale also works, and lets you reach your computer from anywhere.

OPEN SOURCE
The app and the bridge are MIT licensed. The source is at github.com/0x962/aside-mobile-manager.

Sidecar is an independent project. It is not affiliated with, endorsed, sponsored, or supported by the makers of Aside. Aside and the Aside name and logo are trademarks of their respective owner.

## Keywords (100 characters)

aside,agent,ai browser,remote,client,sessions,transcript,developer,bridge,automation

## Support and marketing

- **Support URL:** https://github.com/0x962/aside-mobile-manager
- **Marketing URL:** https://github.com/0x962/aside-mobile-manager
- **Privacy policy URL:** https://github.com/0x962/aside-mobile-manager/blob/main/PRIVACY.md
- **Copyright:** 2026 Thera North, Inc.
- **Support email:** aside@nvdk.co

## App privacy

Answer **Data Not Collected**. The app has no analytics, no accounts, and no
servers of its own. It talks only to a bridge on a computer the user owns.

## Encryption

`ITSAppUsesNonExemptEncryption` is `false` in the build. The app uses no
encryption of its own; its bearer token travels over a private network.

## Screenshots

`store/screenshots/6.9-inch/` holds four 1320 x 2868 captures from a release
build: the introduction, the sessions list, the pairing screen, and a session
transcript. The same files satisfy the 6.5 inch requirement after scaling, or
recapture on an iPhone 16 Plus simulator.

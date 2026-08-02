# App Review notes

Paste the section below into the Notes field in App Store Connect.

---

Sidecar is an unofficial, open source client for Aside, a third-party AI browser
that users run on their own Mac. The app has no accounts, no sign-up, and no
servers of ours. It talks only to a small open source service, the bridge, that
the user installs on their own computer.

REVIEWING WITHOUT A MAC

The app cannot reach a reviewer's computer, so it ships a full demo mode. On
first launch, tap through the two introduction screens, then tap "Try the demo"
at the bottom of the pairing screen. The demo needs no computer, no bridge, and
no network.

Demo mode exercises the whole app:
- The sessions list, grouped by day.
- Any session's full transcript, including the agent's steps and tool calls.
- Sending a message: type in the composer and send. The reply streams in, with
  the working steps appearing as they happen.
- Starting a new session with the New session button, including the model picker.
- Settings, with the paired computer list and the legal notices.

A purple glow and a DEMO badge mark demo mode. Tapping the badge leaves it and
returns to the pairing screen.

PERMISSIONS

- Camera: used only to scan the pairing QR code that the user's own computer
  displays. Demo mode never needs it.
- Local network: used to reach the bridge on the user's own computer. The bridge
  is a plain HTTP service on a private address, which is why the build carries an
  App Transport Security exception for local networking.

PAIRING, IF YOU WISH TO TEST THE REAL PATH

The bridge is public and installs with two commands on any Mac:
  brew install 0x962/tap/minibridge
  brew services start minibridge
It then opens a QR code on that Mac's screen; scanning it in the app connects the
two. Source: https://github.com/0x962/aside-mobile-manager

INTELLECTUAL PROPERTY

The app is named in the "for Aside" form and states in its own interface, its
description, and its Settings screen that it is unofficial and not affiliated
with the makers of Aside.

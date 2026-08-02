#!/bin/bash
# Install minibridge as a launchd agent. Optional: --with-aside keeps Aside.app running too.
set -euo pipefail
cd "$(dirname "$0")"

npm install
npm approve-scripts node-pty >/dev/null 2>&1 || true
npm rebuild node-pty
chmod +x node_modules/node-pty/prebuilds/*/spawn-helper 2>/dev/null || true

NODE="$(command -v node)"
DIR="$(pwd)"
AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$AGENTS" "$HOME/Library/Logs"

sed -e "s|@NODE@|$NODE|g" -e "s|@DIR@|$DIR|g" -e "s|@HOME@|$HOME|g" \
  launchd/co.nvdk.minibridge.plist > "$AGENTS/co.nvdk.minibridge.plist"
launchctl bootout "gui/$(id -u)/co.nvdk.minibridge" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENTS/co.nvdk.minibridge.plist"
echo "minibridge agent loaded. Logs: ~/Library/Logs/minibridge.log"

if [[ "${1:-}" == "--with-aside" ]]; then
  sed -e "s|@HOME@|$HOME|g" launchd/co.nvdk.aside.plist > "$AGENTS/co.nvdk.aside.plist"
  launchctl bootout "gui/$(id -u)/co.nvdk.aside" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/co.nvdk.aside.plist"
  echo "aside agent loaded."
fi

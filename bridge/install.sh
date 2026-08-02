#!/bin/bash
# Install the Aside bridge and keep it running at login.
#
#   curl -fsSL https://raw.githubusercontent.com/0x962/aside-mobile-manager/main/bridge/install.sh | bash
#
# Options:
#   --with-aside   also keep Aside.app running at login
#   --no-agent     install the files but do not load the launchd agent
set -euo pipefail

REPO="${MINIBRIDGE_REPO:-0x962/aside-mobile-manager}"
BRANCH="${MINIBRIDGE_BRANCH:-main}"
PREFIX="${MINIBRIDGE_PREFIX:-$HOME/.minibridge}"
DIR="$PREFIX/bridge"
LABEL="${MINIBRIDGE_LABEL:-co.nvdk.minibridge}"
NODE_VERSION="${MINIBRIDGE_NODE_VERSION:-22.14.0}"
WITH_ASIDE=false
LOAD_AGENT=true
for arg in "$@"; do
  case "$arg" in
    --with-aside) WITH_ASIDE=true ;;
    --no-agent) LOAD_AGENT=false ;;
  esac
done

say() { printf '\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# 1. The bridge files. A checkout installs itself; a piped run downloads.
# ---------------------------------------------------------------------------

SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [[ -n "$SRC" && -f "$SRC/server.mjs" ]]; then
  if [[ "$SRC" != "$DIR" ]]; then
    say "Copying the bridge to $DIR"
    mkdir -p "$DIR"
    rsync -a --exclude node_modules "$SRC/" "$DIR/" 2>/dev/null ||
      { tar -C "$SRC" --exclude node_modules -cf - . | tar -C "$DIR" -xf -; }
  fi
else
  say "Downloading the bridge"
  mkdir -p "$DIR"
  TMP="$(mktemp -d)"
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" |
    tar -xz -C "$TMP" --strip-components=2 "*/bridge"
  cp -R "$TMP/." "$DIR/"
  rm -rf "$TMP"
fi
cd "$DIR"

# ---------------------------------------------------------------------------
# 2. Node. An existing one is used when it is new enough, so nothing lands on
#    the system behind the user's back; otherwise a private copy goes in PREFIX.
# ---------------------------------------------------------------------------

node_ok() {
  local bin="$1"
  command -v "$bin" >/dev/null 2>&1 || return 1
  local major
  major="$("$bin" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [[ "$major" -ge 20 ]]
}

NODE=""
if node_ok "$PREFIX/node/bin/node"; then
  NODE="$PREFIX/node/bin/node"
elif node_ok node; then
  NODE="$(command -v node)"
else
  ARCH="$([[ "$(uname -m)" == "arm64" ]] && echo arm64 || echo x64)"
  say "Installing a private copy of Node $NODE_VERSION"
  mkdir -p "$PREFIX/node"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-$ARCH.tar.gz" |
    tar -xz -C "$PREFIX/node" --strip-components=1
  NODE="$PREFIX/node/bin/node"
fi
export PATH="$(dirname "$NODE"):$PATH"
NPM="$(dirname "$NODE")/npm"
[[ -x "$NPM" ]] || NPM="$(command -v npm)"

# ---------------------------------------------------------------------------
# 3. Dependencies. npm withholds the node-pty build step until it is approved.
# ---------------------------------------------------------------------------

say "Installing dependencies"
"$NPM" install --silent --no-audit --no-fund
"$NPM" approve-scripts node-pty >/dev/null 2>&1 || true
"$NPM" rebuild node-pty --silent >/dev/null 2>&1 || true
chmod +x node_modules/node-pty/prebuilds/*/spawn-helper 2>/dev/null || true
chmod +x "$DIR/pair.sh" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 4. The launchd agent, then pairing.
# ---------------------------------------------------------------------------

if [[ "$LOAD_AGENT" == true ]]; then
  AGENTS="$HOME/Library/LaunchAgents"
  mkdir -p "$AGENTS" "$HOME/Library/Logs"
  sed -e "s|@NODE@|$NODE|g" -e "s|@DIR@|$DIR|g" -e "s|@HOME@|$HOME|g" \
    launchd/co.nvdk.minibridge.plist > "$AGENTS/$LABEL.plist"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/$LABEL.plist"
  say "The bridge is running, and starts again at login."

  if [[ "$WITH_ASIDE" == true ]]; then
    sed -e "s|@HOME@|$HOME|g" launchd/co.nvdk.aside.plist > "$AGENTS/co.nvdk.aside.plist"
    launchctl bootout "gui/$(id -u)/co.nvdk.aside" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$AGENTS/co.nvdk.aside.plist"
    say "Aside starts at login too."
  fi

  for _ in $(seq 1 20); do
    curl -fsS -m 2 "http://127.0.0.1:${MINIBRIDGE_PORT:-4720}/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
  echo
  say "Now pair your phone."
  bash "$DIR/pair.sh" || true
  echo
  echo "To pair another device later, run:"
  echo "  $DIR/pair.sh"
else
  say "Installed to $DIR. Start it with: $NODE $DIR/server.mjs"
fi

echo "Logs: ~/Library/Logs/minibridge.log"

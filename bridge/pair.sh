#!/bin/bash
# Show a pairing code on this machine's screen. Scan it with the phone app to
# connect a device that has never reached this machine before.
set -euo pipefail
PORT="${MINIBRIDGE_PORT:-4720}"

if ! curl -fsS -m 5 -X POST "http://127.0.0.1:$PORT/pair" \
  -d '{"label":"pair.sh"}' >/dev/null; then
  echo "The bridge did not answer on port $PORT. Start it with ./install.sh, then run this again." >&2
  exit 1
fi

echo "A pairing code is open on this screen. Scan it in the phone app."
echo "The code expires in 3 minutes."

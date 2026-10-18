#!/usr/bin/env bash
# Startet einen lokalen Server, führt alle Tests aus tests/*.mjs aus und
# beendet den Server anschließend wieder. Benötigt Node.js und Playwright
# (siehe README.md, Abschnitt "Tests ausführen").
# Aufruf: ./scripts/run-tests.sh [port]   (Standard-Port: 8099)
set -uo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8099}"

python3 -m http.server "${PORT}" > /tmp/plaettchenmodell-test-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" 2>/dev/null' EXIT

# Kurz warten, bis der Server bereit ist.
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://localhost:${PORT}/index.html"; then break; fi
  sleep 0.2
done

export PM_TEST_URL="http://localhost:${PORT}/index.html"

STATUS=0
for test_file in tests/*.mjs; do
  if [ "$(basename "$test_file")" = "helpers.mjs" ]; then continue; fi
  echo "=== ${test_file} ==="
  node "$test_file" || STATUS=1
  echo
done

exit $STATUS

#!/usr/bin/env bash
# Startet einen lokalen statischen Webserver für dieses Projekt.
# Aufruf: ./scripts/dev-server.sh [port]   (Standard-Port: 8099)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8099}"
echo "Starte lokalen Server auf http://localhost:${PORT}/index.html (Strg+C zum Beenden)"
python3 -m http.server "${PORT}"

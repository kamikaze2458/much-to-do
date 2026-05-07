#!/usr/bin/env bash
set -euo pipefail
ACTION="${1:-up}"
case "$ACTION" in
  up)
    docker compose up --build -d
    echo "✓ Stack running → http://localhost:8080"
    docker compose ps
    ;;
  down)
    docker compose down
    ;;
  logs)
    docker compose logs -f
    ;;
  *)
    echo "Usage: $0 [up|down|logs]"
    exit 1
    ;;
esac

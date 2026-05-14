#!/usr/bin/env bash
# scripts/health-check.sh
# Smoke-test the backend API through the ALB.
# Usage: ./scripts/health-check.sh <alb-dns-name>
set -euo pipefail

ALB_DNS="${1:?Pass ALB DNS name as argument: ./health-check.sh <alb-dns>}"
BASE="http://$ALB_DNS"
RETRIES=15
PAUSE=10

check() {
  local path="$1" expected="${2:-200}"
  local url="$BASE$path"
  echo -n "  Checking $path … "
  for i in $(seq 1 "$RETRIES"); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url" || echo "000")
    if [[ "$CODE" == "$expected" ]]; then
      echo "OK ($CODE)"
      return 0
    fi
    echo -n "[$CODE] "
    sleep "$PAUSE"
  done
  echo ""
  echo "FAIL: $path never returned HTTP $expected"
  return 1
}

echo "==> Smoke-testing $BASE"
check "/health"
check "/ready"
check "/api/v1/todos"
echo "==> All health checks passed ✓"

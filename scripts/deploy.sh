#!/usr/bin/env bash
# Prompt Manager one-command deploy (Docker spec V1.1).
#
# Usage: run inside the docker deployment copy
# (Developer/coding/docker/prompt-manager):
#   bash scripts/deploy.sh
#
# Preconditions:
#   1. Changes to deploy are already committed and pushed to GitHub master
#      (this script only fast-forwards; it never merges);
#   2. .env.local exists in this directory (private config, not in Git).
#
# Flow: record rollback point -> git pull --ff-only -> compose build ->
# compose up -d -> verify HTTP.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== rollback point =="
OLD_HEAD=$(git rev-parse --short HEAD)
OLD_IMAGE=$(docker images --format '{{.ID}}' prompt-manager-prompt-manager:latest | head -1)
echo "git HEAD: $OLD_HEAD"
echo "image: prompt-manager-prompt-manager:latest (${OLD_IMAGE:-none})"

echo "== git pull --ff-only =="
git pull --ff-only origin master
NEW_HEAD=$(git rev-parse --short HEAD)
echo "deploy target HEAD: $NEW_HEAD"

echo "== docker compose build =="
docker compose --env-file .env.local build

echo "== docker compose up -d =="
docker compose --env-file .env.local up -d

echo "== verify =="
sleep 5
docker compose --env-file .env.local ps
PORT="${APP_PORT:-3100}"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}" || true)
NEW_IMAGE=$(docker images --format '{{.ID}}' prompt-manager-prompt-manager:latest | head -1)
echo "HTTP status: $CODE"
echo "new image: $NEW_IMAGE"
if [ "$CODE" = "200" ]; then
  echo "DEPLOY OK: git $OLD_HEAD -> $NEW_HEAD, image ${OLD_IMAGE:-none} -> $NEW_IMAGE"
else
  echo "WARNING: HTTP not 200 ($CODE). Check: docker compose --env-file .env.local logs --tail 50"
  exit 1
fi

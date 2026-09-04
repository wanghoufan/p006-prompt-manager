#!/usr/bin/env bash
# Prompt Manager 一键部署脚本（Docker 自托管规范 V1.1）
#
# 用法：在 `docker` 部署副本（Developer/coding/docker/prompt-manager）内运行：
#   bash scripts/deploy.sh
#
# 前提：
#   1. 本次部署的改动已 commit + push 到 GitHub master（本脚本只快进拉取，不做合并）；
#   2. 本目录存在 .env.local（私密配置，不进 Git；首次由 Services 迁移而来）。
#
# 流程：记录回滚点 → git pull --ff-only → compose build → compose up -d → 验证 HTTP。
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== 部署前回滚点 =="
OLD_HEAD=$(git rev-parse --short HEAD)
OLD_IMAGE=$(docker images --format '{{.ID}}' prompt-manager-prompt-manager:latest | head -1)
echo "git HEAD: $OLD_HEAD"
echo "镜像: prompt-manager-prompt-manager:latest (${OLD_IMAGE:-无})"

echo "== git pull --ff-only =="
git pull --ff-only origin master
NEW_HEAD=$(git rev-parse --short HEAD)
echo "部署目标 HEAD: $NEW_HEAD"

echo "== docker compose build =="
docker compose --env-file .env.local build

echo "== docker compose up -d =="
docker compose --env-file .env.local up -d

echo "== 验证 =="
sleep 5
docker compose --env-file .env.local ps
PORT="${APP_PORT:-3100}"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}" || true)
NEW_IMAGE=$(docker images --format '{{.ID}}' prompt-manager-prompt-manager:latest | head -1)
echo "HTTP 状态: $CODE"
echo "新镜像: $NEW_IMAGE"
if [ "$CODE" = "200" ]; then
  echo "✅ 部署成功：git $OLD_HEAD → $NEW_HEAD，镜像 ${OLD_IMAGE:-无} → $NEW_IMAGE"
else
  echo "⚠️ HTTP 非 200（$CODE），请检查：docker compose --env-file .env.local logs --tail 50"
  exit 1
fi

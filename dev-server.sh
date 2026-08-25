#!/bin/sh
# ============================================================
# Prompt Manager dev server 管理脚本
# 用法:
#   ./dev-server.sh run       前台运行（含 watchdog，挂了自动重启，Ctrl+C 退出）
#   ./dev-server.sh start     后台启动（nohup，终端/会话环境适用）
#   ./dev-server.sh stop      停止
#   ./dev-server.sh restart   重启
#   ./dev-server.sh status    查看状态
#   ./dev-server.sh logs      跟踪日志 (Ctrl+C 退出)
# ============================================================

BASE="/Users/zzymima0000/Developer/coding/1.Active/ing丨0813提示词管理器 mac gpt桌面 v1.0"
NODE="/Users/zzymima0000/.workbuddy/binaries/node/versions/22.22.2/bin/node"
NODE_DIR="/Users/zzymima0000/.workbuddy/binaries/node/versions/22.22.2/bin"
NEXT="$BASE/node_modules/next/dist/bin/next"
OUT="$BASE/data/dev-server.log"
WATCHDOG_PID_FILE="$BASE/data/dev-server.pid"
NEXT_PID_FILE="$BASE/data/dev-next.pid"

# 忽略 SIGHUP，防止会话结束时被 Hangup 杀掉
trap '' 1

run() {
  mkdir -p "$BASE/data"
  echo "$$" > "$WATCHDOG_PID_FILE"
  echo "[watchdog] $(date "+%F %T") 启动 watchdog pid=$$" >> "$OUT"
  while true; do
    cd "$BASE" || exit 1
    export PATH="$NODE_DIR:/usr/local/bin:/usr/bin:/bin"
    "$NODE" "$NEXT" dev -H 0.0.0.0 -p 3000 >> "$OUT" 2>&1 &
    NPID=$!
    echo "$NPID" > "$NEXT_PID_FILE"
    echo "[watchdog] $(date "+%F %T") next dev 启动 pid=$NPID" >> "$OUT"
    wait "$NPID"
    CODE=$?
    echo "[watchdog] $(date "+%F %T") next dev 退出(码 $CODE)，3 秒后自动重启" >> "$OUT"
    sleep 3
  done
}

start() {
  if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE")" 2>/dev/null; then
    echo "服务已在运行 (watchdog pid=$(cat "$WATCHDOG_PID_FILE"))"
    return 0
  fi
  nohup sh "$0" run >> "$OUT" 2>&1 &
  echo "已启动 watchdog (pid=$!)，日志: $OUT"
  sleep 4
  status
}

stop() {
  WPID=$(cat "$WATCHDOG_PID_FILE" 2>/dev/null)
  NPID=$(cat "$NEXT_PID_FILE" 2>/dev/null)
  [ -n "$NPID" ] && kill "$NPID" 2>/dev/null && echo "已停止 next dev (pid=$NPID)"
  [ -n "$WPID" ] && kill "$WPID" 2>/dev/null && echo "已停止 watchdog (pid=$WPID)"
  rm -f "$WATCHDOG_PID_FILE" "$NEXT_PID_FILE"
  lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  echo "服务已停止"
}

status() {
  if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE")" 2>/dev/null; then
    echo "watchdog: 运行中 (pid=$(cat "$WATCHDOG_PID_FILE"))"
  else
    echo "watchdog: 未运行"
  fi
  if [ -f "$NEXT_PID_FILE" ] && kill -0 "$(cat "$NEXT_PID_FILE")" 2>/dev/null; then
    echo "next dev: 运行中 (pid=$(cat "$NEXT_PID_FILE"))"
  else
    echo "next dev: 未运行"
  fi
  printf "HTTP: "
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 3 http://localhost:3000 2>/dev/null || echo "不可达"
}

case "$1" in
  run)     run ;;
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  logs)    tail -f "$OUT" ;;
  *)       echo "用法: $0 {run|start|stop|restart|status|logs}" ;;
esac

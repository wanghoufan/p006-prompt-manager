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
NEXT="$BASE/node_modules/next/dist/bin/next"
OUT="$BASE/data/dev-server.log"
WATCHDOG_PID_FILE="$BASE/data/dev-server.pid"
NEXT_PID_FILE="$BASE/data/dev-next.pid"

# 端口统一在这里改。3100 而非 3000：3000 太容易与本机其他 Web 服务冲突。
PORT="${PORT:-3100}"

# 解析 node 可执行文件。不要硬编码路径——托管目录的版本号带后缀（如
# 22.22.2-2），升级后旧路径会失效，watchdog 会陷入「启动→127→重启」死循环。
# 优先级：NODE_BIN 环境变量 > 托管目录里版本号最高的 > PATH 里的 node。
resolve_node() {
  if [ -n "$NODE_BIN" ] && [ -x "$NODE_BIN" ]; then
    echo "$NODE_BIN"
    return 0
  fi
  found=""
  for d in "$HOME"/.workbuddy/binaries/node/versions/*/bin; do
    [ -x "$d/node" ] && found="$d/node"
  done
  if [ -n "$found" ]; then
    echo "$found"
    return 0
  fi
  command -v node 2>/dev/null && return 0
  return 1
}

NODE="$(resolve_node)"
if [ -z "$NODE" ]; then
  echo "错误：找不到 node 可执行文件。请设置 NODE_BIN=/path/to/node 后重试。"
  exit 1
fi
NODE_DIR="$(dirname "$NODE")"

# 忽略 SIGHUP，防止会话结束时被 Hangup 杀掉
trap '' 1

run() {
  mkdir -p "$BASE/data"
  echo "$$" > "$WATCHDOG_PID_FILE"
  echo "[watchdog] $(date "+%F %T") 启动 watchdog pid=$$" >> "$OUT"
  while true; do
    cd "$BASE" || exit 1
    export PATH="$NODE_DIR:/usr/local/bin:/usr/bin:/bin"
    "$NODE" "$NEXT" dev -H 0.0.0.0 -p "$PORT" >> "$OUT" 2>&1 &
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
  # 先按端口查，而不是只看 pid 文件：pid 文件会残留，导致多个 watchdog 并存、
  # 互相覆盖 pid、并让新起的 next dev 因端口占用反复退出。
  if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $PORT 已被占用（服务可能已在运行）。先执行 $0 stop 再启动。"
    status
    return 1
  fi
  if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE")" 2>/dev/null; then
    echo "watchdog 已在运行 (pid=$(cat "$WATCHDOG_PID_FILE"))"
    status
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
  # 只匹配 "run" 子命令，避免 pkill 误杀正在执行 stop 的自身进程
  pkill -f "dev-server\.sh run" 2>/dev/null
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  echo "服务已停止"
}

status() {
  if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE")" 2>/dev/null; then
    echo "watchdog: 运行中 (pid=$(cat "$WATCHDOG_PID_FILE"))"
  else
    echo "watchdog: 未运行"
  fi
  # 用端口探测判断服务，而不是 pid 文件：next dev 会 spawn 子进程，
  # pid 文件里记的常常是已经退出的启动器进程，导致这里误报「未运行」。
  NPID=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$NPID" ]; then
    echo "next dev: 运行中 (pid=$NPID, 端口 $PORT)"
  else
    echo "next dev: 未运行"
  fi
  printf "HTTP: "
  # 超时给到 10 秒：next dev 首次访问要现场编译，3 秒会把它误判成「不可达」。
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 "http://127.0.0.1:$PORT" 2>/dev/null || echo "不可达"
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

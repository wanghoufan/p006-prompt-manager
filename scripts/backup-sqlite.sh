#!/usr/bin/env bash
# SQLite 备份/恢复脚本（VACUUM INTO 在线热备，不锁库）。
# 用法：
#   bash scripts/backup-sqlite.sh backup [db_path] [backup_dir]   # 备份
#   bash scripts/backup-sqlite.sh restore <backup_file> [db_path]  # 恢复
#   bash scripts/backup-sqlite.sh list [backup_dir]               # 列出备份
# 不指定 db_path 时：优先 env SQLITE_DB_PATH，否则 ./data/prompt-manager.db。
# 不指定 backup_dir 时：优先 env SQLITE_BACKUP_DIR，否则 ./backups。
set -euo pipefail

ACTION="${1:-}"
DEFAULT_DB="${SQLITE_DB_PATH:-$(pwd)/data/prompt-manager.db}"
DEFAULT_BACKUP_DIR="${SQLITE_BACKUP_DIR:-$(pwd)/backups}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

usage() {
  cat <<EOF
用法：
  bash scripts/backup-sqlite.sh backup [db_path] [backup_dir]
  bash scripts/backup-sqlite.sh restore <backup_file> [db_path]
  bash scripts/backup-sqlite.sh list [backup_dir]
EOF
  exit 1
}

check_sqlite() {
  if ! command -v sqlite3 &>/dev/null; then
    echo "错误：未找到 sqlite3 CLI。macOS 自带；Linux 用 apt/brew install sqlite。" >&2
    exit 1
  fi
}

do_backup() {
  local db="$1" backup_dir="$2"
  if [[ ! -f "$db" ]]; then
    echo "错误：数据库文件不存在：$db" >&2
    exit 1
  fi
  mkdir -p "$backup_dir"
  local backup_file="${backup_dir}/prompt-manager-${TIMESTAMP}.db"

  # VACUUM INTO 在线热备：生成紧凑的完整副本，不阻塞读写。
  sqlite3 "$db" "VACUUM INTO '${backup_file}';"

  # 校验备份完整性。
  local integrity
  integrity=$(sqlite3 "$backup_file" "PRAGMA integrity_check;" 2>&1)
  if [[ "$integrity" != "ok" ]]; then
    echo "错误：备份完整性检查失败：$integrity" >&2
    rm -f "$backup_file"
    exit 1
  fi

  local size
  size=$(du -h "$backup_file" | cut -f1)
  echo "备份成功：${backup_file}（${size}）"
  echo "完整性：ok"
}

do_restore() {
  local backup_file="$1" db="$2"
  if [[ ! -f "$backup_file" ]]; then
    echo "错误：备份文件不存在：$backup_file" >&2
    exit 1
  fi

  # 先校验备份完整性。
  local integrity
  integrity=$(sqlite3 "$backup_file" "PRAGMA integrity_check;" 2>&1)
  if [[ "$integrity" != "ok" ]]; then
    echo "错误：备份文件完整性检查失败：$integrity" >&2
    exit 1
  fi

  # 如果目标库存在，先自动做一次安全备份。
  if [[ -f "$db" ]]; then
    local auto_backup="${db}.pre-restore-${TIMESTAMP}.bak"
    cp "$db" "$auto_backup"
    echo "已自动备份当前库到：${auto_backup}"
  fi

  # 关闭 WAL/SHM 副产物后覆盖。
  local wal="${db}-wal" shm="${db}-shm"
  mkdir -p "$(dirname "$db")"
  cp "$backup_file" "$db"
  rm -f "$wal" "$shm"

  echo "恢复成功：${backup_file} → ${db}"
}

do_list() {
  local backup_dir="$1"
  if [[ ! -d "$backup_dir" ]]; then
    echo "备份目录不存在：$backup_dir"
    return
  fi
  local files
  files=$(ls -1 "${backup_dir}"/prompt-manager-*.db 2>/dev/null || true)
  if [[ -z "$files" ]]; then
    echo "无备份文件。"
    return
  fi
  echo "备份目录：${backup_dir}"
  echo "---"
  while IFS= read -r f; do
    local size
    size=$(du -h "$f" | cut -f1)
    local name
    name=$(basename "$f")
    echo "${name}  ${size}"
  done <<< "$files"
}

check_sqlite

case "$ACTION" in
  backup)
    do_backup "${2:-$DEFAULT_DB}" "${3:-$DEFAULT_BACKUP_DIR}"
    ;;
  restore)
    [[ -z "${2:-}" ]] && usage
    do_restore "$2" "${3:-$DEFAULT_DB}"
    ;;
  list)
    do_list "${2:-$DEFAULT_BACKUP_DIR}"
    ;;
  *)
    usage
    ;;
esac
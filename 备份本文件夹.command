#!/bin/bash
# 双击运行：把「本文件所在的文件夹」全量备份到统一备份区。
# 想在别的项目用，把这个文件复制到那个文件夹里就行。

# 关键：双击执行时终端的起始目录是家目录，必须先切到本文件所在目录
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.local/bin:$PATH"

echo "要备份的文件夹："
echo "  $(pwd)"
echo ""

if command -v pbackup >/dev/null 2>&1; then
  pbackup
else
  echo "❌ 找不到 pbackup 命令"
  echo "   它应该安装在 ~/.local/bin/pbackup"
fi

echo ""
read -n 1 -s -r -p "按任意键关闭窗口…"
echo

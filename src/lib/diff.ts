export type DiffLineKind = 'same' | 'add' | 'del'

export interface DiffLine {
  kind: DiffLineKind
  text: string
}

/**
 * P3-2 简易行级 diff（LCS）。
 * a = 旧文本（版本快照），b = 新文本（当前正文）。
 * 返回合并后的差异行序列：
 * - del = 旧版有、当前已无/被改的行（回滚会恢复）
 * - add = 当前新增、旧版没有的行（回滚会丢失）
 * - same = 两版一致
 */
export function lineDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const n = aLines.length
  const m = bLines.length
  // LCS DP（O(n·m)，版本最多 10 条、正文规模有限，开销可忽略）
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ kind: 'same', text: aLines[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: 'del', text: aLines[i] })
      i++
    } else {
      out.push({ kind: 'add', text: bLines[j] })
      j++
    }
  }
  while (i < n) out.push({ kind: 'del', text: aLines[i++] })
  while (j < m) out.push({ kind: 'add', text: bLines[j++] })
  return out
}

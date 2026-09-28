import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/**
 * Prompt Manager 本地 SQLite 主库封装。
 *
 * 规则（见《Mac Mini 本地 SQLite 数据库规范》）：
 * - 一个项目一个数据库文件；文件名 = project_slug = prompt-manager.db；
 * - 正式库位于 DockerData/prompt-manager/（bind mount 到容器 /app/data），开发库位于 <cwd>/data/；
 * - 结构变更一律走 db/migrations/*.sql（进入 Git），真实 .db 永不进入 Git；
 * - 运行配置：foreign_keys=ON、journal_mode=WAL、busy_timeout=5000；
 * - 业务代码通过本模块集中访问，浏览器永不直连 .db。
 *
 * 数据库文件路径优先级：env SQLITE_DB_PATH > process.cwd()/data/prompt-manager.db。
 */

const DEFAULT_DB_FILE = path.join(process.cwd(), 'data', 'prompt-manager.db')
const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations')

let database: DatabaseSync | null = null

function applyPragmas(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
}

function runMigrations(db: DatabaseSync): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  )
  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  const applied = new Set(appliedRows.map((row) => row.version))

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort()
  for (const file of files) {
    const version = Number(file.slice(0, file.indexOf('_')))
    if (applied.has(version)) continue
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        version,
        file,
        new Date().toISOString(),
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Migration ${file} 执行失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export function getDb(): DatabaseSync {
  if (database) return database
  const file = process.env.SQLITE_DB_PATH?.trim() || DEFAULT_DB_FILE
  mkdirSync(path.dirname(file), { recursive: true })
  database = new DatabaseSync(file)
  applyPragmas(database)
  runMigrations(database)
  return database
}

export function closeDb(): void {
  if (database) {
    database.close()
    database = null
  }
}

/** 移除开发库文件（仅供测试/重建使用；绝不对正式库调用）。 */
export function removeDbFiles(): void {
  closeDb()
  const file = process.env.SQLITE_DB_PATH?.trim() || DEFAULT_DB_FILE
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(`${file}${suffix}`)
    } catch {
      // 文件不存在时忽略
    }
  }
}

/**
 * SQLite 在线备份：VACUUM INTO 生成一致性快照。
 * 目标路径必须不存在或为空文件；调用方负责清理旧备份。
 */
export function backupDatabase(destPath: string): void {
  const db = getDb()
  const escaped = destPath.replace(/'/g, "''")
  db.exec(`VACUUM INTO '${escaped}'`)
}

export interface IntegrityResult {
  integrity: string
  foreignKeyViolations: unknown[]
  schemaVersion: number
}

export function checkIntegrity(): IntegrityResult {
  const db = getDb()
  const integrityRow = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all()
  const versionRow = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null }
  return {
    integrity: integrityRow.integrity_check,
    foreignKeyViolations: fkViolations,
    schemaVersion: versionRow.v ?? 0,
  }
}

/** 单行设置读取（settings 表 id=1）。 */
export function getSettingsRow(): Record<string, unknown> | null {
  const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get()
  return row ? (row as Record<string, unknown>) : null
}

/** 供一次性迁移脚本直接使用。 */
export function getMigrationsDir(): string {
  return MIGRATIONS_DIR
}
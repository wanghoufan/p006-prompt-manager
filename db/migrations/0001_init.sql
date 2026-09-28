-- 0001_init.sql
-- Prompt Manager 本地 SQLite 主库初始化（迁移自 Supabase prompt_manager schema，单用户去 owner_user_id）。
-- 生效配置：PRAGMA foreign_keys=ON; journal_mode=WAL; busy_timeout=5000;（见 src/lib/db/sqlite.ts）
-- 已发布 Migration 不回改；新结构一律新增 0002_*.sql。

CREATE TABLE IF NOT EXISTS cards (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body             TEXT NOT NULL,
  code             TEXT,
  rating           INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  copy_count       INTEGER NOT NULL DEFAULT 0 CHECK (copy_count >= 0),
  thinking_summary TEXT,
  notes            TEXT NOT NULL DEFAULT '',
  source_url       TEXT NOT NULL DEFAULT '',
  revision         INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  CHECK (code IS NULL OR (length(code) BETWEEN 1 AND 64 AND code NOT GLOB '*[^a-z0-9-]*'))
);

CREATE UNIQUE INDEX idx_cards_code ON cards (code) WHERE code IS NOT NULL;
CREATE INDEX idx_cards_updated_at ON cards (updated_at DESC);

CREATE TABLE IF NOT EXISTS card_versions (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_card_versions_card_created ON card_versions (card_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
  parent_id  TEXT REFERENCES tags (id) ON DELETE RESTRICT,
  icon       TEXT,
  is_pinned  INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_tags_parent_name ON tags (COALESCE(parent_id, ''), lower(trim(name)));
CREATE INDEX idx_tags_parent_sort ON tags (parent_id, sort_order, name);

CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id TEXT NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  tag_id    TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, tag_id)
);

CREATE INDEX idx_prompt_tags_tag ON prompt_tags (tag_id, prompt_id);

CREATE TABLE IF NOT EXISTS settings (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  thinking_summary_prompt TEXT NOT NULL DEFAULT '',
  confirm_delete          INTEGER NOT NULL DEFAULT 1 CHECK (confirm_delete IN (0, 1)),
  theme                   TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('dark', 'light', 'system')),
  auto_format_body        INTEGER NOT NULL DEFAULT 0 CHECK (auto_format_body IN (0, 1)),
  body_alignment          TEXT NOT NULL DEFAULT 'left' CHECK (body_alignment IN ('left', 'center', 'right')),
  composer_add_mode       TEXT NOT NULL DEFAULT 'auto' CHECK (composer_add_mode IN ('auto', 'manual')),
  hover_preview           INTEGER NOT NULL DEFAULT 0 CHECK (hover_preview IN (0, 1)),
  ai_provider             TEXT NOT NULL DEFAULT 'deepseek',
  ai_model                TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
  ai_base_url             TEXT NOT NULL DEFAULT '',
  revision                INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  token_hash   TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
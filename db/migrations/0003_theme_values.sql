-- 0003_theme_values.sql
-- 2026-10-11 三套新主题：settings.theme CHECK 由 ('dark','light','system')
-- 放宽为 ('dark','light','system','cinnabar','phosphor','blueprint')。
-- SQLite 不支持 ALTER CHECK，单行 settings 表整表重建（列含 0002 新增的 composer_auto_tags/title）。

ALTER TABLE settings RENAME TO settings_old;

CREATE TABLE settings (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  thinking_summary_prompt TEXT NOT NULL DEFAULT '',
  confirm_delete          INTEGER NOT NULL DEFAULT 1 CHECK (confirm_delete IN (0, 1)),
  theme                   TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('dark', 'light', 'system', 'cinnabar', 'phosphor', 'blueprint')),
  auto_format_body        INTEGER NOT NULL DEFAULT 0 CHECK (auto_format_body IN (0, 1)),
  body_alignment          TEXT NOT NULL DEFAULT 'left' CHECK (body_alignment IN ('left', 'center', 'right')),
  composer_add_mode       TEXT NOT NULL DEFAULT 'auto' CHECK (composer_add_mode IN ('auto', 'manual')),
  hover_preview           INTEGER NOT NULL DEFAULT 0 CHECK (hover_preview IN (0, 1)),
  ai_provider             TEXT NOT NULL DEFAULT 'deepseek',
  ai_model                TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
  ai_base_url             TEXT NOT NULL DEFAULT '',
  revision                INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  composer_auto_tags      INTEGER NOT NULL DEFAULT 1 CHECK (composer_auto_tags IN (0, 1)),
  composer_auto_title     INTEGER NOT NULL DEFAULT 1 CHECK (composer_auto_title IN (0, 1))
);

INSERT INTO settings (
  id, thinking_summary_prompt, confirm_delete, theme, auto_format_body, body_alignment,
  composer_add_mode, hover_preview, ai_provider, ai_model, ai_base_url,
  revision, created_at, updated_at, composer_auto_tags, composer_auto_title
)
SELECT
  id, thinking_summary_prompt, confirm_delete, theme, auto_format_body, body_alignment,
  composer_add_mode, hover_preview, ai_provider, ai_model, ai_base_url,
  revision, created_at, updated_at, composer_auto_tags, composer_auto_title
FROM settings_old;

DROP TABLE settings_old;

-- 0002_composer_auto_flags.sql
-- Composer 建卡偏好持久化：自动生成标签 / 自动生成标题 升级为 settings 正式字段。
-- 「自动格式整理」复用已有 auto_format_body 列，不加列。
-- 默认值与历史行为一致：标签/标题默认开（1）。已发布 Migration 不回改。

ALTER TABLE settings ADD COLUMN composer_auto_tags  INTEGER NOT NULL DEFAULT 1 CHECK (composer_auto_tags  IN (0, 1));
ALTER TABLE settings ADD COLUMN composer_auto_title INTEGER NOT NULL DEFAULT 1 CHECK (composer_auto_title IN (0, 1));

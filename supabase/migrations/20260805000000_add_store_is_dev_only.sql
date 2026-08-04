-- 開発用の架空店舗を本番環境では非表示・注文不可にするためのフラグ。
-- 既存の is_published（出店中トグル）とは独立した設定。

alter table stores
  add column if not exists is_dev_only boolean not null default false;

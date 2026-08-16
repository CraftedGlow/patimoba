-- 管理者アカウント設定画面の通知設定チェックボックスを永続化するためのカラム。

alter table users
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;

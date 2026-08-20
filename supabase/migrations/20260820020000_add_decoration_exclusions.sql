-- デコレーションの排他ルール: このデコレーションが選ばれたら除外するカテゴリーを指定できるようにする
-- 例: プリントデコレーション選択時は「プレート」カテゴリーを選択不可にする

alter table decorations
  add column if not exists excludes_categories text[] not null default '{}';

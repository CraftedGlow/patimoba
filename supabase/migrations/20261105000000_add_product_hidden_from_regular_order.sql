-- 「クリスマス限定」等の特別枠専用商品を、通常のテイクアウト注文一覧には表示しないようにする。
-- デフォルトはfalse（通常注文にも表示される）。
alter table products
  add column if not exists hidden_from_regular_order boolean not null default false;

-- 商品ごとに決済方法を制限できるようにする（例: 店頭決済のみ）
-- payment_method_restriction は null なら制限なし。値は 'store_only' を想定（今後拡張可能な自由記述にしておく）
-- 共有商品でも店舗ごとに違う制限を設定できるよう product_store_overrides にも同じ列を追加する
-- あわせて、注文に実際に選ばれた決済方法を記録する列を orders に追加する（従来は payment_status からの逆算のみだった）

alter table products
  add column if not exists payment_method_restriction text;

alter table product_store_overrides
  add column if not exists payment_method_restriction text;

alter table orders
  add column if not exists payment_method text;

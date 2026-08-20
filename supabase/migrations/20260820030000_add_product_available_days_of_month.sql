-- 商品の「毎月何日に受け取れるか」を設定できるようにする
-- available_days_of_month が null または空配列なら制限なし（従来通り毎日受け取り可能）
-- 共有商品でも店舗ごとに違う日付を設定できるよう product_store_overrides にも同じ列を追加する

alter table products
  add column if not exists available_days_of_month integer[];

alter table product_store_overrides
  add column if not exists available_days_of_month integer[];

-- おまかせ商品など、確定金額ではなく金額の幅（例: ¥3,500〜4,500）で見せたい商品向け。
-- base_price は引き続き注文時の確定金額（実務上はカート/決済で使う値）として使い、
-- price_min/price_max は表示用の目安レンジ。両方 null なら通常商品（幅表示なし）。
-- 共有商品でも店舗ごとに違う金額幅を設定できるよう product_store_overrides にも追加する。

alter table products
  add column if not exists price_min integer,
  add column if not exists price_max integer;

alter table product_store_overrides
  add column if not exists price_min integer,
  add column if not exists price_max integer;

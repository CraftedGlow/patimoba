-- 店舗単位で決済方法を制限できるようにする（例: カード決済のみ／店頭決済のみ）
-- payment_method_restriction は null なら制限なし（両方利用可）。
-- 値は 'card_only'（カード決済のみ） / 'store_only'（店頭決済のみ）を想定（自由記述で今後拡張可能）。
-- 商品ごとの payment_method_restriction（20260820040000）と共存し、商品側の指定がある場合はそちらを優先する。

alter table stores
  add column if not exists payment_method_restriction text;

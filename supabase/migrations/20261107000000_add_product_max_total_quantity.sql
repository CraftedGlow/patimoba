-- 商品自体の累計予約数上限（期間限定商品の総数制限、例: クリスマスケーキ全国30個まで）。
-- nullなら上限なし（従来通り）。既存の daily_max_quantity（1日あたりの上限）とは別軸。
alter table products
  add column if not exists max_total_quantity integer;

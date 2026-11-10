-- 注文作成APIの冪等化（二重注文・二重課金の防止）
--
-- 背景: 注文作成API（/api/customer/takeout-order, /api/ec/create-order）の応答が通信エラー等で
-- 失われると、画面はエラー表示になり、お客様が再送すると同じ注文がもう1件作られ二重に課金されていた。
--
-- 方針: 会計画面が「注文確定の試行」ごとに UUID を1つ生成し、再送時も同じ値を送る。
-- サーバーはこの値を orders.client_request_id に保存し、同じ値の注文が既にあれば新しく作らずに
-- その注文の結果を返す。同時に2つの要求が届いた場合も一意インデックスで1件に絞られる。

alter table public.orders
  add column if not exists client_request_id uuid;

create unique index if not exists orders_client_request_id_unique
  on public.orders (client_request_id)
  where client_request_id is not null;

-- 決済の結果を確認できなかった・返金に失敗した等で、取り消さずに保留した注文の印。
-- 作成処理が完了していない（points_settled_at 未設定）注文は店舗画面に表示しないが、
-- この印の付いた注文は店舗が対応できるよう表示する（lib/order-visibility.ts）。サーバーのみが設定する
alter table public.orders
  add column if not exists needs_attention boolean not null default false;

-- お客様（anon / authenticated）による注文・注文明細・オプションの直接作成を禁止する
--
-- 背景: テイクアウト注文はこれまで会計画面から RLS 経由で直接 insert されており、
-- 小計・割引・明細の単価などをお客様が自由に書き換えて注文できた。
-- 注文作成はすべてサーバー（service_role）の API（/api/customer/takeout-order, /api/ec/create-order）で
-- DB上の商品・オプション価格から金額を再計算して行うようになったため、お客様本人による insert を許可する
-- 条件（customer_id = current_app_user_id()）を外す。店舗スタッフ・アプリ管理者の権限は従来どおり。
--
-- 注意: 新しい会計画面（サーバーAPI経由で注文する版）をデプロイしてから適用すること。

drop policy if exists "orders_insert_customer_or_staff" on public.orders;
create policy "orders_insert_customer_or_staff"
  on public.orders for insert
  with check (
    public.is_app_admin()
    or public.is_store_member(store_id)
  );

drop policy if exists "order_items_insert_via_order" on public.order_items;
create policy "order_items_insert_via_order"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          public.is_app_admin()
          or public.is_store_member(o.store_id)
        )
    )
  );

drop policy if exists "order_item_options_insert_via_item" on public.order_item_options;
create policy "order_item_options_insert_via_item"
  on public.order_item_options for insert
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and (
          public.is_app_admin()
          or public.is_store_member(o.store_id)
        )
    )
  );

-- 20261106000300 の適用後〜新しい会計画面のデプロイ前（およびこのマイグレーション適用前）に
-- 更新前の画面から直接作成された注文は、points_settled_at が未設定のまま店舗画面に表示されなくなるため、
-- 従来どおり「反映済み」として扱う（更新前の画面は自分でポイントを反映していた）。
-- 新しいサーバーAPI経由の注文は必ず client_request_id を持つため対象外。
update public.orders
  set points_settled_at = created_at
  where points_settled_at is null
    and client_request_id is null
    and needs_attention = false;

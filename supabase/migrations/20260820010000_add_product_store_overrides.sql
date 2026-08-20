-- 共有商品（マスター登録）の受付状況などを店舗ごとに独立させる
-- 商品情報（名前・画像・説明・価格など）は共有のまま、受付状況・当日受付・
-- 最大個数・準備日数だけを店舗ごとに上書きできるようにする。
-- 未上書きの項目は products（共有マスタ）の値をそのまま使う。

create table if not exists product_store_overrides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  is_active boolean,
  same_day_order_allowed boolean,
  daily_max_quantity integer,
  preparation_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, store_id)
);

alter table product_store_overrides enable row level security;

create policy "product_store_overrides_select_public"
  on public.product_store_overrides for select
  using (true);

-- 上書きの書き込みは、その店舗自身、またはそのマスター店舗のスタッフのみ許可
create policy "product_store_overrides_staff_all"
  on public.product_store_overrides for all
  using (public.is_app_admin() or public.is_store_member_or_master(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_master(store_id));

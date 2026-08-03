-- 地域別配送料: 店舗ごとの上書き設定を追加する
-- 未上書きの地域は shipping_rate_regions（運営管理の共有マスタ、店舗の発地×届け先地域）の値をそのまま使う。
-- 発地は店舗の postal_code から自動判定して store_shipping_settings.origin_region に保存する（店舗が選択する項目ではない）。

create table if not exists store_shipping_rate_overrides (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  destination_region text not null,
  fee integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, destination_region)
);

alter table store_shipping_rate_overrides enable row level security;

create policy "store_shipping_rate_overrides_select_public"
  on public.store_shipping_rate_overrides for select
  using (true);

create policy "store_shipping_rate_overrides_staff_all"
  on public.store_shipping_rate_overrides for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

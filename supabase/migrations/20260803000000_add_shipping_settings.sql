-- EC配送料設定: 店舗ごとの配送料ルールと、地域別料金の共有マスタを追加する

-- =========================================
-- 1. store_shipping_settings（店舗ごとの配送料設定、store_order_rulesと同じ1店舗1行パターン）
-- =========================================
create table if not exists store_shipping_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references stores(id) on delete cascade,
  mode text not null default 'flat' check (mode in ('flat', 'region')),
  flat_fee integer not null default 0,
  origin_region text,
  free_shipping_enabled boolean not null default false,
  free_shipping_threshold integer,
  free_shipping_excludes_special_regions boolean not null default true,
  remote_surcharge integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table store_shipping_settings enable row level security;

create policy "store_shipping_settings_select_public"
  on public.store_shipping_settings for select
  using (true);

create policy "store_shipping_settings_staff_all"
  on public.store_shipping_settings for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

-- =========================================
-- 2. shipping_rate_regions（運営が管理する地域別送料の共有マスタ。platform_settingsと同様に店舗を跨いで参照される）
-- =========================================
create table if not exists shipping_rate_regions (
  id uuid primary key default gen_random_uuid(),
  origin_region text not null,
  destination_region text not null,
  fee integer not null,
  updated_at timestamptz not null default now(),
  unique (origin_region, destination_region)
);

alter table shipping_rate_regions enable row level security;

create policy "shipping_rate_regions_select_public"
  on public.shipping_rate_regions for select
  using (true);

create policy "shipping_rate_regions_admin_write"
  on public.shipping_rate_regions for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- 地方ブロックを地理的に近い順に並べ、その並び順の差分（距離）から目安送料を機械的にseedする。
-- ヤマト運輸の早見表を参考にした概算値であり、正確な最新料金は運営側が本テーブルを直接編集して調整すること。
with blocks(region, ord) as (
  values
    ('北海道', 0), ('東北', 1), ('関東', 2), ('信越', 3), ('北陸', 4),
    ('中部', 5), ('関西', 6), ('中国', 7), ('四国', 8), ('九州', 9), ('沖縄', 10)
)
insert into shipping_rate_regions (origin_region, destination_region, fee)
select
  o.region,
  d.region,
  case
    when o.region = '沖縄' or d.region = '沖縄' then 1800 + abs(o.ord - d.ord) * 50
    else 700 + abs(o.ord - d.ord) * 100
  end as fee
from blocks o
cross join blocks d
on conflict (origin_region, destination_region) do nothing;

-- =========================================
-- 3. orders: 配送先住所・配送時間帯・配送料を構造化して保存する
--    （これまでnotesへの文字列埋め込みのみだった）
-- =========================================
alter table orders
  add column if not exists shipping_fee integer not null default 0,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_prefecture text,
  add column if not exists shipping_city text,
  add column if not exists shipping_address text,
  add column if not exists shipping_building text,
  add column if not exists delivery_time_slot text;

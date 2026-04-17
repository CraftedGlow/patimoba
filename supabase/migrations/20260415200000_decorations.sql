-- デコレーション機能: マスタ・グループ・商品紐付けテーブル

-- decorations: デコレーションマスタ（画像・価格・カテゴリ）
create table public.decorations (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  name          text not null,
  description   text,
  image_url     text,
  category      text not null default 'other'
                check (category in ('fruit', 'plate', 'topping', 'cream', 'other')),
  price         integer not null default 0,
  is_active     boolean not null default true,
  is_seasonal   boolean not null default false,
  season_start  date,
  season_end    date,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- decoration_groups: 選択グループ（single/multiple・必須/任意）
create table public.decoration_groups (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  name           text not null,
  description    text,
  selection_type text not null default 'single'
                 check (selection_type in ('single', 'multiple')),
  max_selections integer,
  required       boolean not null default false,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- decoration_group_items: グループ内デコレーション
create table public.decoration_group_items (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.decoration_groups(id) on delete cascade,
  decoration_id uuid not null references public.decorations(id) on delete cascade,
  display_order integer not null default 0,
  unique (group_id, decoration_id)
);

-- product_decoration_groups: 商品↔グループ紐付け
create table public.product_decoration_groups (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  group_id      uuid not null references public.decoration_groups(id) on delete cascade,
  display_order integer not null default 0,
  unique (product_id, group_id)
);

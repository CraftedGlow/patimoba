-- ろうそくを店舗共通カタログ化する（のし・メッセージプレートと同じ方式）。
-- これまでは products.custom_options 内に商品ごと個別で持っていた。
create table if not exists candles (
  id uuid default gen_random_uuid() primary key,
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  image_url text,
  price integer not null default 0,
  type text not null default 'normal' check (type in ('number','normal')),
  display_order integer not null default 0,
  created_at timestamptz default now()
);

alter table candles enable row level security;

create policy "Store staff can manage their candles"
  on candles for all
  using (public.is_store_member_or_child(store_id))
  with check (public.is_store_member_or_child(store_id));

create policy "Anon can read candles"
  on candles for select
  to anon, authenticated
  using (true);

alter table products
  add column if not exists candle_enabled boolean not null default false,
  add column if not exists candle_ids uuid[] not null default '{}';

-- 既存商品が custom_options 内に個別で持っていた「ろうそく」設定を、店舗共通カタログへ一度だけ移行する。
insert into candles (store_id, name, price, type, image_url)
select distinct on (store_id, name)
  store_id, name, price, type, image_url
from (
  select
    p.store_id as store_id,
    (val.v->>'label') as name,
    coalesce((val.v->>'additional_price')::integer, 0) as price,
    coalesce(val.v->>'type', case when val.v->>'label' = 'ナンバーキャンドル' then 'number' else 'normal' end) as type,
    (val.v->>'image_url') as image_url
  from products p
  cross join lateral jsonb_array_elements(p.custom_options) as opt(o)
  cross join lateral jsonb_array_elements(opt.o->'values') as val(v)
  where opt.o->>'name' = 'ろうそく'
    and (val.v->>'label') is not null and (val.v->>'label') <> ''
) src
where not exists (
  select 1 from candles c where c.store_id = src.store_id and c.name = src.name
)
order by store_id, name;

update products p
set candle_enabled = true,
    candle_ids = sub.ids
from (
  select p2.id as product_id, array_agg(distinct c.id) as ids
  from products p2
  cross join lateral jsonb_array_elements(p2.custom_options) as opt(o)
  cross join lateral jsonb_array_elements(opt.o->'values') as val(v)
  join candles c on c.store_id = p2.store_id and c.name = (val.v->>'label')
  where opt.o->>'name' = 'ろうそく' and (val.v->>'label') is not null and (val.v->>'label') <> ''
  group by p2.id
) sub
where p.id = sub.product_id;

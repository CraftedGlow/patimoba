-- 袋(ラッピングバッグ)機能: 店舗が登録し、対応商品を注文する顧客が選べる持ち帰り袋
create table public.bags (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  name          text not null,
  image_url     text,
  price         integer not null default 0,
  capacity      integer not null default 1,
  product_ids   uuid[] not null default '{}',
  is_active     boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.bags enable row level security;

create policy "bags_select_public"
  on public.bags for select
  using (true);

create policy "bags_staff_all"
  on public.bags for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

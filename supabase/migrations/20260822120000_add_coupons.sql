create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  title text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coupon_deliveries (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.coupons enable row level security;
alter table public.coupon_deliveries enable row level security;

create policy "coupons_select_staff"
  on public.coupons for select
  using (public.is_app_admin() or public.is_store_member_or_master(store_id));

create policy "coupons_insert_staff"
  on public.coupons for insert
  with check (public.is_app_admin() or public.is_store_member_or_master(store_id));

create policy "coupons_update_staff"
  on public.coupons for update
  using (public.is_app_admin() or public.is_store_member_or_master(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_master(store_id));

create policy "coupons_delete_staff"
  on public.coupons for delete
  using (public.is_app_admin() or public.is_store_member_or_master(store_id));

create policy "coupon_deliveries_select_staff"
  on public.coupon_deliveries for select
  using (
    public.is_app_admin() or exists (
      select 1 from public.coupons c
      where c.id = coupon_deliveries.coupon_id
        and public.is_store_member_or_master(c.store_id)
    )
  );

create policy "coupon_deliveries_insert_staff"
  on public.coupon_deliveries for insert
  with check (
    public.is_app_admin() or exists (
      select 1 from public.coupons c
      where c.id = coupon_deliveries.coupon_id
        and public.is_store_member_or_master(c.store_id)
    )
  );

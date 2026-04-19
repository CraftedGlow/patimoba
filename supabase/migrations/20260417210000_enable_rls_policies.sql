-- RLS (Row Level Security) ポリシー設定
-- 役割:
--   admin           : すべて操作可
--   store スタッフ   : 所属店舗のレコードのみ管理可 (store_users.is_active = true)
--   customer        : 自分のプロフィール・注文のみ操作可
--   anon (未ログイン): 公開情報 (店舗・商品・デコレーション) のみ閲覧可
-- ※ Service Role Key 経由のサーバーサイド処理 (app/api/...) は RLS をバイパスする

-- =========================================
-- ヘルパー関数 (SECURITY DEFINER)
-- =========================================

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid()
      and user_type = 'admin'
  )
$$;

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_users su
    join public.users u on u.id = su.user_id
    where su.store_id = p_store_id
      and su.is_active = true
      and u.auth_user_id = auth.uid()
  )
$$;

grant execute on function public.current_app_user_id() to anon, authenticated;
grant execute on function public.is_app_admin()        to anon, authenticated;
grant execute on function public.is_store_member(uuid) to anon, authenticated;

-- =========================================
-- RLS 有効化
-- =========================================
alter table public.stores                    enable row level security;
alter table public.users                     enable row level security;
alter table public.user_roles                enable row level security;
alter table public.store_users               enable row level security;
alter table public.store_business_hours      enable row level security;
alter table public.store_order_rules         enable row level security;
alter table public.store_special_dates       enable row level security;
alter table public.products                  enable row level security;
alter table public.product_variants          enable row level security;
alter table public.decorations               enable row level security;
alter table public.decoration_groups         enable row level security;
alter table public.decoration_group_items    enable row level security;
alter table public.product_decoration_groups enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.order_item_options        enable row level security;

-- =========================================
-- stores
-- =========================================
create policy "stores_select_public"
  on public.stores for select
  using (true);

create policy "stores_insert_admin"
  on public.stores for insert
  with check (public.is_app_admin());

create policy "stores_update_admin_or_staff"
  on public.stores for update
  using (public.is_app_admin() or public.is_store_member(id))
  with check (public.is_app_admin() or public.is_store_member(id));

create policy "stores_delete_admin"
  on public.stores for delete
  using (public.is_app_admin());

-- =========================================
-- users
-- =========================================
create policy "users_select_self"
  on public.users for select
  using (auth_user_id = auth.uid());

create policy "users_select_admin"
  on public.users for select
  using (public.is_app_admin());

create policy "users_select_store_customers"
  on public.users for select
  using (
    exists (
      select 1 from public.orders o
      where o.customer_id = public.users.id
        and public.is_store_member(o.store_id)
    )
  );

create policy "users_insert_self_or_admin"
  on public.users for insert
  with check (
    auth_user_id = auth.uid()
    or public.is_app_admin()
  );

create policy "users_update_self"
  on public.users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "users_update_admin"
  on public.users for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "users_delete_admin"
  on public.users for delete
  using (public.is_app_admin());

-- =========================================
-- user_roles
-- =========================================
create policy "user_roles_select_self_or_admin"
  on public.user_roles for select
  using (
    user_id = public.current_app_user_id()
    or public.is_app_admin()
  );

create policy "user_roles_admin_all"
  on public.user_roles for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =========================================
-- store_users
-- =========================================
create policy "store_users_select_self_admin_or_member"
  on public.store_users for select
  using (
    user_id = public.current_app_user_id()
    or public.is_app_admin()
    or public.is_store_member(store_id)
  );

create policy "store_users_admin_all"
  on public.store_users for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =========================================
-- store_business_hours / store_order_rules / store_special_dates
-- =========================================
create policy "store_business_hours_select_public"
  on public.store_business_hours for select
  using (true);

create policy "store_business_hours_staff_all"
  on public.store_business_hours for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

create policy "store_order_rules_select_public"
  on public.store_order_rules for select
  using (true);

create policy "store_order_rules_staff_all"
  on public.store_order_rules for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

create policy "store_special_dates_select_public"
  on public.store_special_dates for select
  using (true);

create policy "store_special_dates_staff_all"
  on public.store_special_dates for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

-- =========================================
-- products / product_variants
-- =========================================
create policy "products_select_public"
  on public.products for select
  using (true);

create policy "products_staff_all"
  on public.products for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

create policy "product_variants_select_public"
  on public.product_variants for select
  using (true);

create policy "product_variants_staff_all"
  on public.product_variants for all
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and public.is_store_member(p.store_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and public.is_store_member(p.store_id)
    )
  );

-- =========================================
-- decorations / decoration_groups / decoration_group_items / product_decoration_groups
-- =========================================
create policy "decorations_select_public"
  on public.decorations for select
  using (true);

create policy "decorations_staff_all"
  on public.decorations for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

create policy "decoration_groups_select_public"
  on public.decoration_groups for select
  using (true);

create policy "decoration_groups_staff_all"
  on public.decoration_groups for all
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

create policy "decoration_group_items_select_public"
  on public.decoration_group_items for select
  using (true);

create policy "decoration_group_items_staff_all"
  on public.decoration_group_items for all
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.decoration_groups g
      where g.id = decoration_group_items.group_id
        and public.is_store_member(g.store_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.decoration_groups g
      where g.id = decoration_group_items.group_id
        and public.is_store_member(g.store_id)
    )
  );

create policy "product_decoration_groups_select_public"
  on public.product_decoration_groups for select
  using (true);

create policy "product_decoration_groups_staff_all"
  on public.product_decoration_groups for all
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_decoration_groups.product_id
        and public.is_store_member(p.store_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_decoration_groups.product_id
        and public.is_store_member(p.store_id)
    )
  );

-- =========================================
-- orders
-- =========================================
create policy "orders_select_customer"
  on public.orders for select
  using (customer_id = public.current_app_user_id());

create policy "orders_select_staff"
  on public.orders for select
  using (public.is_app_admin() or public.is_store_member(store_id));

create policy "orders_insert_customer_or_staff"
  on public.orders for insert
  with check (
    customer_id = public.current_app_user_id()
    or public.is_app_admin()
    or public.is_store_member(store_id)
  );

create policy "orders_update_staff"
  on public.orders for update
  using (public.is_app_admin() or public.is_store_member(store_id))
  with check (public.is_app_admin() or public.is_store_member(store_id));

create policy "orders_delete_admin"
  on public.orders for delete
  using (public.is_app_admin());

-- =========================================
-- order_items
-- =========================================
create policy "order_items_select_via_order"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = public.current_app_user_id()
          or public.is_app_admin()
          or public.is_store_member(o.store_id)
        )
    )
  );

create policy "order_items_insert_via_order"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = public.current_app_user_id()
          or public.is_app_admin()
          or public.is_store_member(o.store_id)
        )
    )
  );

create policy "order_items_update_staff"
  on public.order_items for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.is_app_admin() or public.is_store_member(o.store_id))
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.is_app_admin() or public.is_store_member(o.store_id))
    )
  );

create policy "order_items_delete_admin"
  on public.order_items for delete
  using (public.is_app_admin());

-- =========================================
-- order_item_options
-- =========================================
create policy "order_item_options_select_via_item"
  on public.order_item_options for select
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and (
          o.customer_id = public.current_app_user_id()
          or public.is_app_admin()
          or public.is_store_member(o.store_id)
        )
    )
  );

create policy "order_item_options_insert_via_item"
  on public.order_item_options for insert
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and (
          o.customer_id = public.current_app_user_id()
          or public.is_app_admin()
          or public.is_store_member(o.store_id)
        )
    )
  );

create policy "order_item_options_update_staff"
  on public.order_item_options for update
  using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and (public.is_app_admin() or public.is_store_member(o.store_id))
    )
  )
  with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_options.order_item_id
        and (public.is_app_admin() or public.is_store_member(o.store_id))
    )
  );

create policy "order_item_options_delete_admin"
  on public.order_item_options for delete
  using (public.is_app_admin());

-- Multi-store RLS: master store owners can read child store data

-- New helper: true if current user is a member of the store OR its master store
create or replace function public.is_store_member_or_master(p_store_id uuid)
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
    where su.is_active = true
      and u.auth_user_id = auth.uid()
      and (
        su.store_id = p_store_id
        or su.store_id = (
          select parent_store_id from public.stores where id = p_store_id
        )
      )
  )
$$;

grant execute on function public.is_store_member_or_master(uuid) to anon, authenticated;

-- orders: master can SELECT and UPDATE child store orders
drop policy if exists "orders_select_staff" on public.orders;
create policy "orders_select_staff"
  on public.orders for select
  using (public.is_app_admin() or public.is_store_member_or_master(store_id));

drop policy if exists "orders_update_staff" on public.orders;
create policy "orders_update_staff"
  on public.orders for update
  using (public.is_app_admin() or public.is_store_member_or_master(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_master(store_id));

-- order_items: follow order access
drop policy if exists "order_items_select_via_order" on public.order_items;
create policy "order_items_select_via_order"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = public.current_app_user_id()
          or public.is_app_admin()
          or public.is_store_member_or_master(o.store_id)
        )
    )
  );

drop policy if exists "order_items_update_staff" on public.order_items;
create policy "order_items_update_staff"
  on public.order_items for update
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.is_app_admin() or public.is_store_member_or_master(o.store_id))
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.is_app_admin() or public.is_store_member_or_master(o.store_id))
    )
  );

-- order_item_options: follow order access
drop policy if exists "order_item_options_select_via_item" on public.order_item_options;
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
          or public.is_store_member_or_master(o.store_id)
        )
    )
  );

-- users: master can see customers who ordered at child stores
drop policy if exists "users_select_store_customers" on public.users;
create policy "users_select_store_customers"
  on public.users for select
  using (
    exists (
      select 1 from public.orders o
      where o.customer_id = public.users.id
        and public.is_store_member_or_master(o.store_id)
    )
  );

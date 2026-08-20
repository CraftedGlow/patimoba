-- Child store staff can also edit products/decorations/bags/noshi registered
-- under their master (parent) store, since these rows are shared across the
-- whole store group and either side should be able to manage them.

create or replace function public.is_store_member_or_child(p_store_id uuid)
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
        or p_store_id = (
          select parent_store_id from public.stores where id = su.store_id
        )
      )
  )
$$;

grant execute on function public.is_store_member_or_child(uuid) to anon, authenticated;

-- products
drop policy if exists "products_staff_all" on public.products;
create policy "products_staff_all"
  on public.products for all
  using (public.is_app_admin() or public.is_store_member_or_child(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_child(store_id));

-- decorations
drop policy if exists "decorations_staff_all" on public.decorations;
create policy "decorations_staff_all"
  on public.decorations for all
  using (public.is_app_admin() or public.is_store_member_or_child(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_child(store_id));

-- bags
drop policy if exists "bags_staff_all" on public.bags;
create policy "bags_staff_all"
  on public.bags for all
  using (public.is_app_admin() or public.is_store_member_or_child(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_child(store_id));

-- noshi
drop policy if exists "Store staff can manage their noshi" on public.noshi;
create policy "Store staff can manage their noshi"
  on public.noshi for all
  using (public.is_store_member_or_child(store_id))
  with check (public.is_store_member_or_child(store_id));

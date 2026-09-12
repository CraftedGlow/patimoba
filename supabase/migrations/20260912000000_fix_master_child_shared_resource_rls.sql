-- マスターアカウントが「店舗ごと」表示で子店舗を選択した際、商品・デコレーション・のし・
-- メッセージプレート・ろうそく・袋・営業日・配送設定・店舗情報などへの書き込みが
-- RLSに拒否されてしまう不具合を修正する。
--
-- これまで:
--   - is_store_member_or_child(p_store_id): 子店舗スタッフが親(マスター)所有の行を編集できる
--     （子→親方向）。products/decorations/bags/noshi/message_plates/candles にのみ適用済み。
--   - is_store_member_or_master(p_store_id): マスターが子店舗所有の行を編集できる
--     （親→子方向）。orders/coupons/product_store_overrides にのみ適用済み。
-- どちらの方向も正当な操作だが、共有カタログ系テーブルは子→親方向しか許可されておらず、
-- マスターが子店舗を選んで保存すると RLS 違反で書き込みが失敗していた。
--
-- 両方向をまとめた is_store_member_or_related を定義し、店舗グループ内で共有される
-- カタログ・設定系テーブル全てに適用する。

create or replace function public.is_store_member_or_related(p_store_id uuid)
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
        or su.store_id = (select parent_store_id from public.stores where id = p_store_id)
        or p_store_id = (select parent_store_id from public.stores where id = su.store_id)
      )
  )
$$;

grant execute on function public.is_store_member_or_related(uuid) to anon, authenticated;

-- =========================================
-- products / product_variants
-- =========================================
drop policy if exists "products_staff_all" on public.products;
create policy "products_staff_all"
  on public.products for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "product_variants_staff_all" on public.product_variants;
create policy "product_variants_staff_all"
  on public.product_variants for all
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and public.is_store_member_or_related(p.store_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and public.is_store_member_or_related(p.store_id)
    )
  );

-- =========================================
-- decorations / decoration_groups / decoration_group_items / product_decoration_groups
-- =========================================
drop policy if exists "decorations_staff_all" on public.decorations;
create policy "decorations_staff_all"
  on public.decorations for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "decoration_groups_staff_all" on public.decoration_groups;
create policy "decoration_groups_staff_all"
  on public.decoration_groups for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "decoration_group_items_staff_all" on public.decoration_group_items;
create policy "decoration_group_items_staff_all"
  on public.decoration_group_items for all
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.decoration_groups g
      where g.id = decoration_group_items.group_id
        and public.is_store_member_or_related(g.store_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.decoration_groups g
      where g.id = decoration_group_items.group_id
        and public.is_store_member_or_related(g.store_id)
    )
  );

drop policy if exists "product_decoration_groups_staff_all" on public.product_decoration_groups;
create policy "product_decoration_groups_staff_all"
  on public.product_decoration_groups for all
  using (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_decoration_groups.product_id
        and public.is_store_member_or_related(p.store_id)
    )
  )
  with check (
    public.is_app_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_decoration_groups.product_id
        and public.is_store_member_or_related(p.store_id)
    )
  );

-- =========================================
-- bags / noshi / message_plates / candles
-- =========================================
drop policy if exists "bags_staff_all" on public.bags;
create policy "bags_staff_all"
  on public.bags for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "Store staff can manage their noshi" on public.noshi;
create policy "Store staff can manage their noshi"
  on public.noshi for all
  using (public.is_store_member_or_related(store_id))
  with check (public.is_store_member_or_related(store_id));

drop policy if exists "Store staff can manage their message plates" on public.message_plates;
create policy "Store staff can manage their message plates"
  on public.message_plates for all
  using (public.is_store_member_or_related(store_id))
  with check (public.is_store_member_or_related(store_id));

drop policy if exists "Store staff can manage their candles" on public.candles;
create policy "Store staff can manage their candles"
  on public.candles for all
  using (public.is_store_member_or_related(store_id))
  with check (public.is_store_member_or_related(store_id));

-- =========================================
-- store_business_hours / store_order_rules / store_special_dates
-- =========================================
drop policy if exists "store_business_hours_staff_all" on public.store_business_hours;
create policy "store_business_hours_staff_all"
  on public.store_business_hours for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "store_order_rules_staff_all" on public.store_order_rules;
create policy "store_order_rules_staff_all"
  on public.store_order_rules for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "store_special_dates_staff_all" on public.store_special_dates;
create policy "store_special_dates_staff_all"
  on public.store_special_dates for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

-- =========================================
-- stores（マスターが子店舗のロゴ・営業設定・臨時休業期間などを編集できるように）
-- =========================================
drop policy if exists "stores_update_admin_or_staff" on public.stores;
create policy "stores_update_admin_or_staff"
  on public.stores for update
  using (public.is_app_admin() or public.is_store_member_or_related(id))
  with check (public.is_app_admin() or public.is_store_member_or_related(id));

-- =========================================
-- store_shipping_settings / store_shipping_rate_overrides
-- =========================================
drop policy if exists "store_shipping_settings_staff_all" on public.store_shipping_settings;
create policy "store_shipping_settings_staff_all"
  on public.store_shipping_settings for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

drop policy if exists "store_shipping_rate_overrides_staff_all" on public.store_shipping_rate_overrides;
create policy "store_shipping_rate_overrides_staff_all"
  on public.store_shipping_rate_overrides for all
  using (public.is_app_admin() or public.is_store_member_or_related(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_related(store_id));

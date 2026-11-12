-- お客様のブラウザ（anonキー）からは orders_select_customer ポリシーにより自分自身の注文しか
-- 見えず、「この商品が全顧客分でどれだけ売れているか」を集計できない（daily_max_quantity /
-- max_total_quantity の売り切れ表示が機能しない原因）。集計値（商品ID・数量のみ、個人情報は含まない）
-- だけを返す SECURITY DEFINER 関数を用意し、anon/authenticated から呼べるようにする。

create or replace function public.get_products_sold_quantity(p_product_ids uuid[])
returns table(product_id uuid, total_quantity bigint)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, coalesce(sum(oi.quantity), 0)::bigint as total_quantity
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id = any(p_product_ids)
    and o.order_status <> 'cancelled'
  group by oi.product_id;
$$;

grant execute on function public.get_products_sold_quantity(uuid[]) to anon, authenticated;

create or replace function public.get_products_sold_quantity_by_date(
  p_product_ids uuid[],
  p_from_date date,
  p_to_date date
)
returns table(product_id uuid, pickup_date date, total_quantity bigint)
language sql
security definer
set search_path = public
as $$
  select oi.product_id, o.pickup_date, coalesce(sum(oi.quantity), 0)::bigint as total_quantity
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id = any(p_product_ids)
    and o.pickup_date between p_from_date and p_to_date
    and o.order_status <> 'cancelled'
  group by oi.product_id, o.pickup_date;
$$;

grant execute on function public.get_products_sold_quantity_by_date(uuid[], date, date) to anon, authenticated;

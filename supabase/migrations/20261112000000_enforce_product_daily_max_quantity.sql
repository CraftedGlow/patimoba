-- 商品の1日あたりの予約数上限（products.daily_max_quantity）を、注文明細の挿入時に
-- サーバー側（DB側）で厳密に強制する。enforce_product_max_total_quantity と同様に
-- products 行を FOR UPDATE でロックしてから、同じ受取日の既存の非キャンセル注文の
-- 合計数量を数えることで、同時に複数の注文が来ても上限を超えて受け付けないようにする。
-- 受取日（orders.pickup_date）が無い注文（EC発送など）には受取日の概念が無いため対象外とする。
create or replace function enforce_product_daily_max_quantity()
returns trigger as $$
declare
  v_max integer;
  v_pickup_date date;
  v_current numeric;
begin
  if new.product_id is null then
    return new;
  end if;

  select pickup_date into v_pickup_date
  from orders
  where id = new.order_id;

  if v_pickup_date is null then
    return new;
  end if;

  select daily_max_quantity into v_max
  from products
  where id = new.product_id
  for update;

  if v_max is null then
    return new;
  end if;

  select coalesce(sum(oi.quantity), 0) into v_current
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.product_id = new.product_id
    and o.pickup_date = v_pickup_date
    and o.order_status <> 'cancelled';

  if v_current + new.quantity > v_max then
    raise exception 'この商品は指定の受取日の受付上限に達したため、ご注文いただけません。お手数ですが受取日またはカート内容をご確認ください。'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql
set search_path = public;

drop trigger if exists trg_enforce_product_daily_max_quantity on order_items;
create trigger trg_enforce_product_daily_max_quantity
before insert on order_items
for each row
execute function enforce_product_daily_max_quantity();

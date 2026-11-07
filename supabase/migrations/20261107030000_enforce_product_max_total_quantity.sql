-- 商品の累計予約数上限（products.max_total_quantity）を、注文明細の挿入時に
-- サーバー側（DB側）で厳密に強制する。products 行を FOR UPDATE でロックしてから
-- 既存の非キャンセル注文の合計数量を数えることで、同時に複数の注文が来ても
-- 上限を超えて受け付けてしまうことを防ぐ。
create or replace function enforce_product_max_total_quantity()
returns trigger as $$
declare
  v_max integer;
  v_current numeric;
begin
  if new.product_id is null then
    return new;
  end if;

  select max_total_quantity into v_max
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
    and o.order_status <> 'cancelled';

  if v_current + new.quantity > v_max then
    raise exception 'この商品は受付上限に達したため、ご注文いただけません。お手数ですがカート内容をご確認ください。'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_product_max_total_quantity on order_items;
create trigger trg_enforce_product_max_total_quantity
before insert on order_items
for each row
execute function enforce_product_max_total_quantity();

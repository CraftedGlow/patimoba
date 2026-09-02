-- クーポン適用時にサーバー側で計算した割引額を coupon_deliveries に保存し、
-- 注文作成時にクライアント申告値を信用せず、この値だけを正としてorderに反映できるようにする。
alter table public.coupon_deliveries add column discount_amount integer not null default 0;

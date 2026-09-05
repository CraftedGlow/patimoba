-- 記念日リマインダー用クーポンは、固定カレンダー日付ではなく各顧客の記念日を起点に
-- 前後◯日間で有効期間を設定できるようにする（通常クーポンは従来通り coupons.valid_from/expires_at の固定日付のまま）。
alter table public.coupons add column anniversary_valid_days_before integer check (anniversary_valid_days_before is null or anniversary_valid_days_before >= 0);
alter table public.coupons add column anniversary_valid_days_after integer check (anniversary_valid_days_after is null or anniversary_valid_days_after >= 0);

alter table public.coupon_deliveries add column valid_from timestamptz;
alter table public.coupon_deliveries add column expires_at timestamptz;

-- 記念日リマインダー送信時に添付するクーポンを、店舗ごとに1件だけ指定できるようにする。
alter table public.coupons add column is_anniversary_coupon boolean not null default false;

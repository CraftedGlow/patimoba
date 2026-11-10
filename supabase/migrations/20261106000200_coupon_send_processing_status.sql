-- 配信予約cron（/api/cron/coupon-send）の二重送信対策。
-- cron は pending の配信予約を pending → processing の条件付き更新で確保してから処理するため、
-- coupon_sends.status に 'processing' を追加する。
--
-- なお coupon_deliveries(coupon_id, user_id) の一意制約（coupon_deliveries_coupon_user_key）は
-- 20260831000000_extend_coupons.sql で作成済みのため、重複データの整理や制約追加は不要。
-- sendCouponPush はこの制約を使って送信前に配布記録を確保する。

alter table public.coupon_sends drop constraint if exists coupon_sends_status_check;

alter table public.coupon_sends
  add constraint coupon_sends_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));

-- 処理中に関数のタイムアウト等で中断された配信予約を再開できるよう、確保した時刻を記録する。
-- cron は processing のまま一定時間経過したものを再確保する（配布記録の一意制約により二重配布はされない）
alter table public.coupon_sends
  add column if not exists processing_started_at timestamptz;

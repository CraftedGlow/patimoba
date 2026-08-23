-- 営業時間（開店〜閉店）とは別に、受け取り可能時間を店舗ごとに設定できるようにする
-- 未設定（null）の場合は従来通り営業時間がそのまま受け取り可能時間として使われる
--
-- store_business_hours.pickup_last_time は既存の未使用カラム（最終受取可能時刻）を
-- そのまま「受け取り終了時刻」として使う。開始時刻に相当するカラムがなかったので追加する。

alter table store_business_hours
  add column if not exists pickup_start_time text;

-- 祝日区分（stores.holiday_open_time/holiday_close_time と対になる受け取り時間）
alter table stores
  add column if not exists holiday_pickup_start_time text,
  add column if not exists holiday_pickup_end_time text;

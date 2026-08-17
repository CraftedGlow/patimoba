alter table public.stores
  add column if not exists holiday_open_time time,
  add column if not exists holiday_close_time time;

-- 既存店舗の祝日営業時間は、月曜（無ければ最初の営業曜日）の営業時間を初期値として引き継ぐ
update public.stores s
set holiday_open_time = coalesce(
      (select bh.open_time from public.store_business_hours bh
       where bh.store_id = s.id and bh.is_closed = false and bh.day_of_week = 1
       limit 1),
      (select bh.open_time from public.store_business_hours bh
       where bh.store_id = s.id and bh.is_closed = false
       order by bh.day_of_week limit 1),
      '10:00'::time
    ),
    holiday_close_time = coalesce(
      (select bh.close_time from public.store_business_hours bh
       where bh.store_id = s.id and bh.is_closed = false and bh.day_of_week = 1
       limit 1),
      (select bh.close_time from public.store_business_hours bh
       where bh.store_id = s.id and bh.is_closed = false
       order by bh.day_of_week limit 1),
      '19:00'::time
    )
where holiday_open_time is null;

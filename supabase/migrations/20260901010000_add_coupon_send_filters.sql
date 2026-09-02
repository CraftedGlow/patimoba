-- 配信対象の母集団を「注文実績がある顧客」から「LINEユーザーIDが取得できている顧客（LIFFログイン済み）」に広げ、
-- そのうえで「注文実績がある人のみ」「性別」を任意条件として絞り込めるようにする。

alter table public.coupon_sends
  add column filter_ordered_only boolean not null default false,
  add column filter_gender text check (filter_gender is null or filter_gender in ('男性', '女性'));

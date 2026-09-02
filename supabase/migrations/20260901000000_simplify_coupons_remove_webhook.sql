-- 友だち追加時の自動配布(Webhook)を廃止し、あいさつメッセージへのリンク貼り付け方式に一本化する。
-- クーポンコードは新しい注文内redemptionフローでは使われないため廃止する。

drop table if exists public.line_friends;

alter table public.coupons
  drop column if exists is_friend_campaign,
  drop column if exists code;

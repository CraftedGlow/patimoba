-- 決済まわりの整合性を担保するための制約・ガード
--
-- 1. 同じ PAY.JP 課金IDを複数の注文で使い回せないよう一意制約を付ける
--    （既存データに重複がある場合はこの CREATE INDEX が失敗するため、先に重複を解消すること）
create unique index if not exists orders_payjp_charge_id_unique
  on public.orders (payjp_charge_id)
  where payjp_charge_id is not null;

-- 2. EC注文確認メールの重複送信防止用（送信済み時刻）
alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

-- 3. クライアント（anon / authenticated ロール）から決済済みの注文を直接作れないようにする。
--    テイクアウト注文は RLS 経由でクライアントから insert されるため、
--    payment_status='paid' や payjp_charge_id を自由に書けると「未決済なのに決済済み」の注文を作れてしまう。
--    決済済みへの更新はサーバー（service_role）が PAY.JP 課金を確認したうえでのみ行う。
create or replace function public.guard_order_payment_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.payment_status in ('paid', 'refunded') or new.payjp_charge_id is not null then
      raise exception 'payment fields can only be set by the server' using errcode = '42501';
    end if;
  elsif new.payjp_charge_id is distinct from old.payjp_charge_id then
    raise exception 'payjp_charge_id can only be set by the server' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_payment_fields on public.orders;
create trigger guard_order_payment_fields
  before insert or update on public.orders
  for each row execute function public.guard_order_payment_fields();

-- 4. users.customer_id / pending_tds_token をクライアントから直接書き換えられないようにする。
--    users_update_self ポリシーにより本人は自分の行を更新できるため、他人の PAY.JP 顧客IDを
--    自分の行に書き込んで /api/payjp/charge 等で他人のカードに課金できてしまうのを防ぐ。
--    これらの列はサーバー（service_role）の PAY.JP カード登録処理でのみ更新する。
create or replace function public.guard_user_payment_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.customer_id is not null or new.pending_tds_token is not null then
      raise exception 'payment fields can only be set by the server' using errcode = '42501';
    end if;
  elsif new.customer_id is distinct from old.customer_id
     or new.pending_tds_token is distinct from old.pending_tds_token then
    raise exception 'payment fields can only be set by the server' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_payment_fields on public.users;
create trigger guard_user_payment_fields
  before insert or update on public.users
  for each row execute function public.guard_user_payment_fields();

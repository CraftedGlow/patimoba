-- ポイントの利用・付与・返還をサーバー側で1回だけ行うようにする
--
-- 背景: これまで会計画面（クライアント）が users.points を直接 update しており、
-- users_update_self ポリシーにより本人が自分のポイントを任意の値に書き換えられた。
-- また注文作成とポイント反映が別々のため、二重反映・反映漏れが起こり得た。
--
-- 方針:
--   * 注文確定時にサーバー（service_role）が settle_order_points() を呼び、
--     「利用ポイントの減算 + 付与ポイントの加算」を注文ごとに1回だけ行う（orders.points_settled_at で冪等化）
--   * キャンセル時は revert_order_points() で、反映済みの注文に限り 利用分を返還・付与分を回収する
--   * クライアント（anon / authenticated、アプリ管理者以外）からの users.points の変更を禁止する

-- 1. 注文ごとのポイント反映状態
alter table public.orders
  add column if not exists points_settled_at timestamptz,
  add column if not exists points_earned integer not null default 0,
  -- キャンセル時にポイントを戻した時刻。points_settled_at は「作成完了」の印として店舗画面の表示判定にも
  -- 使うため、戻した後も消さずに残し、返還済みかどうかはこの列で判定する
  add column if not exists points_reverted_at timestamptz;

-- 既存の注文はクライアント側で既にポイント反映済みのため「反映済み・付与分不明(0)」として扱う。
-- （キャンセル時は従来どおり利用ポイントのみ返還され、付与分は回収しない）
update public.orders
  set points_settled_at = created_at
  where points_settled_at is null;

-- 2. 注文確定時のポイント反映（1注文1回）
create or replace function public.settle_order_points(p_order_id uuid, p_earned integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_used integer;
begin
  if p_earned < 0 then
    raise exception 'invalid earned points';
  end if;

  update public.orders
    set points_settled_at = now(),
        points_earned = p_earned
    where id = p_order_id
      and points_settled_at is null
    returning customer_id, coalesce(discount_amount, 0)::integer
    into v_customer_id, v_used;

  if not found then
    return false; -- 反映済み
  end if;

  if v_customer_id is null then
    return true;
  end if;

  update public.users
    set points = coalesce(points, 0) - v_used + p_earned
    where id = v_customer_id
      and coalesce(points, 0) >= v_used;

  if not found then
    -- 保有ポイント不足（同時に別注文でポイントを使った等）。注文側の反映フラグもロールバックされる
    raise exception 'insufficient_points' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

-- 3. キャンセル時のポイント返還（反映済みの注文のみ・1回だけ）
create or replace function public.revert_order_points(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_used integer;
  v_earned integer;
begin
  update public.orders
    set points_reverted_at = now()
    where id = p_order_id
      and points_settled_at is not null
      and points_reverted_at is null
    returning customer_id, coalesce(discount_amount, 0)::integer, coalesce(points_earned, 0)
    into v_customer_id, v_used, v_earned;

  if not found or v_customer_id is null then
    return false;
  end if;

  -- 付与済みポイントを既に使っている場合でもマイナスにはしない
  update public.users
    set points = greatest(0, coalesce(points, 0) + v_used - v_earned)
    where id = v_customer_id;

  return true;
end;
$$;

revoke all on function public.settle_order_points(uuid, integer) from public, anon, authenticated;
revoke all on function public.revert_order_points(uuid) from public, anon, authenticated;
grant execute on function public.settle_order_points(uuid, integer) to service_role;
grant execute on function public.revert_order_points(uuid) to service_role;

-- 4. クライアントからのポイント・反映状態の書き換えを禁止する
create or replace function public.guard_user_points()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_app_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.points, 0) <> 0 then
      raise exception 'points can only be set by the server' using errcode = '42501';
    end if;
  elsif new.points is distinct from old.points then
    raise exception 'points can only be set by the server' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_points on public.users;
create trigger guard_user_points
  before insert or update on public.users
  for each row execute function public.guard_user_points();

create or replace function public.guard_order_points_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.points_settled_at is not null or new.points_reverted_at is not null or coalesce(new.points_earned, 0) <> 0 then
      raise exception 'points fields can only be set by the server' using errcode = '42501';
    end if;
  elsif new.points_settled_at is distinct from old.points_settled_at
     or new.points_reverted_at is distinct from old.points_reverted_at
     or new.points_earned is distinct from old.points_earned
     or (old.points_settled_at is not null and new.discount_amount is distinct from old.discount_amount) then
    raise exception 'points fields can only be set by the server' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_order_points_fields on public.orders;
create trigger guard_order_points_fields
  before insert or update on public.orders
  for each row execute function public.guard_order_points_fields();

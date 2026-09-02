-- クーポン機能拡張：注文への実適用、利用条件、スケジュール配信、友だち追加キャンペーン

-- ── coupons: 利用条件・有効期間開始・共有リンク・友だち追加キャンペーンフラグ ──
alter table public.coupons
  add column valid_from timestamptz,
  add column min_order_amount integer check (min_order_amount is null or min_order_amount > 0),
  add column whole_cake_only boolean not null default false,
  add column share_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column is_friend_campaign boolean not null default false;

alter table public.coupons add constraint coupons_share_token_key unique (share_token);

-- ── coupon_deliveries: 1人1枚の「クーポン券」として利用状態を持たせる ──
alter table public.coupon_deliveries
  add column claim_method text not null default 'push' check (claim_method in ('push', 'link', 'webhook_follow')),
  add column used_at timestamptz,
  add column order_id uuid references public.orders(id) on delete set null;

alter table public.coupon_deliveries
  add constraint coupon_deliveries_coupon_user_key unique (coupon_id, user_id);

-- ── orders: クーポン適用結果を記録 ──
alter table public.orders
  add column coupon_id uuid references public.coupons(id) on delete set null,
  add column coupon_discount_amount integer not null default 0;

-- ── coupon_sends: 配信予約（即時・日時指定 / 全顧客・個別選択 / 人数上限）の記録 ──
create table public.coupon_sends (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  target_type text not null check (target_type in ('all', 'selected')),
  target_user_ids uuid[],
  recipient_limit integer check (recipient_limit is null or recipient_limit > 0),
  selection_mode text check (selection_mode is null or selection_mode in ('random', 'newest')),
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  result_sent integer,
  result_failed integer,
  result_skipped integer,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.coupon_sends enable row level security;

create policy "coupon_sends_select_staff"
  on public.coupon_sends for select
  using (public.is_app_admin() or public.is_store_member_or_master(store_id));

create policy "coupon_sends_insert_staff"
  on public.coupon_sends for insert
  with check (public.is_app_admin() or public.is_store_member_or_master(store_id));

create policy "coupon_sends_update_staff"
  on public.coupon_sends for update
  using (public.is_app_admin() or public.is_store_member_or_master(store_id))
  with check (public.is_app_admin() or public.is_store_member_or_master(store_id));

-- ── line_friends: LINE友だち追加/ブロックの状態管理（LIFF未ログインの段階でも追跡できるよう独立テーブル） ──
create table public.line_friends (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  line_user_id text not null,
  first_followed_at timestamptz not null default now(),
  follow_status text not null default 'following' check (follow_status in ('following', 'unfollowed')),
  last_event_at timestamptz not null default now(),
  unique (store_id, line_user_id)
);

alter table public.line_friends enable row level security;

create policy "line_friends_select_staff"
  on public.line_friends for select
  using (public.is_app_admin() or public.is_store_member_or_master(store_id));

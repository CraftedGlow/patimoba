create table if not exists public.print_jobs (
  id           uuid        not null default gen_random_uuid() primary key,
  store_id     uuid        not null references public.stores(id) on delete cascade,
  order_id     uuid        references public.orders(id) on delete set null,
  status       text        not null default 'pending'
                             check (status in ('pending', 'printing', 'done', 'error')),
  markup       text        not null,
  delete_token text        not null default gen_random_uuid()::text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists print_jobs_store_pending_idx
  on public.print_jobs (store_id, created_at)
  where status = 'pending';

alter table public.print_jobs enable row level security;

-- 直接クライアントアクセスを拒否（API ルートはservice roleキーを使用するためRLS非適用）
create policy "deny_direct_client_access" on public.print_jobs
  as restrictive
  using (false);

alter table public.users
  add column if not exists customer_id text null;

alter table public.stores
  add column if not exists payjp_tenant_id text null;

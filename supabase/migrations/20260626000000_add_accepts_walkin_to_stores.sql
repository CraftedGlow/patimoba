alter table public.stores
add column if not exists accepts_walkin boolean not null default true;

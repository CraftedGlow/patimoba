-- Add multi-store support columns to stores table
alter table public.stores
  add column parent_store_id uuid references public.stores(id) on delete restrict,
  add column is_master boolean not null default false;

-- Index for efficient child store lookups
create index stores_parent_store_id_idx on public.stores(parent_store_id);

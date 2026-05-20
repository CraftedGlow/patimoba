alter table public.stores
  add column if not exists tokusho_text text;

alter table public.store_business_hours
  add column if not exists closed_week_rule text;

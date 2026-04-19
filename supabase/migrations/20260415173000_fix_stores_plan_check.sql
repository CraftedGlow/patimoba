-- Fix stores.plan constraint to accept current app plan slugs.
-- Keep `free` temporarily for backward compatibility with legacy data.
alter table public.stores
drop constraint if exists stores_plan_check;

alter table public.stores
add constraint stores_plan_check
check (plan in ('light', 'standard', 'premium', 'free'));

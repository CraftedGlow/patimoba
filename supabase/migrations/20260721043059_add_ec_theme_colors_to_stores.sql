alter table public.stores
add column if not exists ec_header_color text,
add column if not exists ec_button_color text,
add column if not exists ec_background_color text;

alter table candles
  add column if not exists free_quantity integer not null default 0;

alter table order_item_options
  add column if not exists free_quantity integer;

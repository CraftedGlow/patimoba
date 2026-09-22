alter table candles
  add column if not exists bag_quantity integer not null default 1;

alter table candles drop constraint if exists candles_type_check;
alter table candles add constraint candles_type_check check (type in ('number', 'normal', 'bag'));

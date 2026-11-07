alter table store_special_dates add column if not exists reservation_stopped boolean not null default false;

alter table stores add column if not exists christmas_checkbox_label text;
alter table stores add column if not exists christmas_checkbox_reveals text[] not null default '{}';

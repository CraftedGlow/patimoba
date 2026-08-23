alter table stores
  add column if not exists anniversary_reminder_enabled boolean not null default true;

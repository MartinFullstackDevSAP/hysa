alter table public.global_settings
  add column if not exists investments_refresh_interval_minutes integer not null default 2;

alter table public.investment_transactions
  alter column isin drop not null,
  add column if not exists exchange text,
  add column if not exists figi text;

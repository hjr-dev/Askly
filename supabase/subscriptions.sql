create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null default 'pro',
  status text not null default 'canceled',
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migración incremental: si la tabla ya existía de una versión anterior,
-- añade las columnas nuevas sin tocar las filas existentes.
alter table public.subscriptions add column if not exists stripe_price_id text;
alter table public.subscriptions add column if not exists plan text not null default 'pro';
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.subscriptions;

create policy "Users can read their own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

-- Necesario para que el cliente reciba los cambios que el webhook de Stripe
-- escribe en esta tabla vía Supabase Realtime (postgres_changes).
alter table public.subscriptions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'subscriptions'
  ) then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;


create policy "read own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);


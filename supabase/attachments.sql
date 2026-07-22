create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_message_id uuid not null references public.messages(id) on delete cascade,
  model_message_id uuid references public.messages(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_bucket text not null default 'message-attachments',
  storage_path text not null unique,
  processing_status text not null default 'ready'
    check (processing_status in ('uploading', 'processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.message_attachments add column if not exists model_message_id uuid references public.messages(id) on delete set null;
alter table public.message_attachments add column if not exists processing_status text not null default 'ready';
alter table public.message_attachments add column if not exists error_message text;

create index if not exists message_attachments_conversation_idx
  on public.message_attachments (conversation_id, created_at);

create index if not exists message_attachments_user_message_idx
  on public.message_attachments (user_message_id);

create index if not exists message_attachments_model_message_idx
  on public.message_attachments (model_message_id);

drop trigger if exists message_attachments_set_updated_at on public.message_attachments;

create trigger message_attachments_set_updated_at
before update on public.message_attachments
for each row execute function public.set_updated_at();

alter table public.message_attachments enable row level security;

drop policy if exists "Users can read their own message attachments" on public.message_attachments;

create policy "Users can read their own message attachments"
on public.message_attachments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can manage their own message attachments" on public.message_attachments;

create policy "Users can manage their own message attachments"
on public.message_attachments
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do update set public = false;

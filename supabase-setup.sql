-- Indoor Diary Supabase setup
-- Ejecuta este archivo en Supabase > SQL Editor > New query > Run.

create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;

drop policy if exists "Users can read own diary state" on public.app_states;
create policy "Users can read own diary state"
  on public.app_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own diary state" on public.app_states;
create policy "Users can insert own diary state"
  on public.app_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own diary state" on public.app_states;
create policy "Users can update own diary state"
  on public.app_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own diary state" on public.app_states;
create policy "Users can delete own diary state"
  on public.app_states
  for delete
  using (auth.uid() = user_id);

-- Buckets reservados para una futura versión donde las fotos se guarden como archivos.
-- La versión actual sincroniza todo el diario como JSON, incluyendo fotos comprimidas.
insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('result-photos', 'result-photos', false)
on conflict (id) do nothing;

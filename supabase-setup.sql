-- Indoor Diary Supabase setup
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Crea la tabla principal, permisos RLS y buckets de fotos para futuras versiones.

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
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own diary state" on public.app_states;
create policy "Users can insert own diary state"
  on public.app_states
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own diary state" on public.app_states;
create policy "Users can update own diary state"
  on public.app_states
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own diary state" on public.app_states;
create policy "Users can delete own diary state"
  on public.app_states
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_states to authenticated;

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('result-photos', 'result-photos', false)
on conflict (id) do nothing;

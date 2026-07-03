create table if not exists public.dashboard_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_state enable row level security;

drop policy if exists "dashboard_state_select_own" on public.dashboard_state;
create policy "dashboard_state_select_own"
on public.dashboard_state for select
using (auth.uid() = user_id);

drop policy if exists "dashboard_state_insert_own" on public.dashboard_state;
create policy "dashboard_state_insert_own"
on public.dashboard_state for insert
with check (auth.uid() = user_id);

drop policy if exists "dashboard_state_update_own" on public.dashboard_state;
create policy "dashboard_state_update_own"
on public.dashboard_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  profile jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

drop policy if exists "google_calendar_tokens_select_own" on public.google_calendar_tokens;
create policy "google_calendar_tokens_select_own"
on public.google_calendar_tokens for select
using (auth.uid() = user_id);

drop policy if exists "google_calendar_tokens_delete_own" on public.google_calendar_tokens;
create policy "google_calendar_tokens_delete_own"
on public.google_calendar_tokens for delete
using (auth.uid() = user_id);


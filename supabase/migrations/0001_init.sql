create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, created_at timestamptz not null default now());
create table public.preferences (
  user_id uuid primary key references auth.users on delete cascade,
  default_budget int, default_radius_km int, vibes text[] not null default '{}', updated_at timestamptz not null default now());
create table public.saved_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  provider text not null, provider_id text not null, name text not null, data jsonb not null,
  created_at timestamptz not null default now(), unique (user_id, provider, provider_id));
create table public.activity_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  provider text not null, provider_id text not null, action text not null, created_at timestamptz not null default now());

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.saved_activities enable row level security;
alter table public.activity_history enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own preferences" on public.preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saved" on public.saved_activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own history" on public.activity_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

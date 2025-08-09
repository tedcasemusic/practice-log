-- Enable UUIDs & realtime
create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  tz text not null default 'America/Los_Angeles',
  daily_goal_minutes int not null default 180,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles owner select"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles owner upsert"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles owner update"
  on public.profiles for update
  using (id = auth.uid());

-- Practice sessions
create table if not exists public.practice_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes int generated always as (ceil(extract(epoch from (ended_at - started_at))/60.0)) stored,
  category text not null check (category in ('scales','review','new','technique')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.practice_sessions enable row level security;

create index if not exists practice_sessions_user_started_idx on public.practice_sessions (user_id, started_at);

create policy "sessions owner select"
  on public.practice_sessions for select
  using (user_id = auth.uid());

create policy "sessions owner insert"
  on public.practice_sessions for insert
  with check (user_id = auth.uid());

create policy "sessions owner update"
  on public.practice_sessions for update
  using (user_id = auth.uid());

create policy "sessions owner delete"
  on public.practice_sessions for delete
  using (user_id = auth.uid());

-- Weekly plans
create table if not exists public.weekly_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  daily_goal_minutes int not null default 180,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_plans enable row level security;

create policy "plans owner select"
  on public.weekly_plans for select
  using (user_id = auth.uid());

create policy "plans owner insert"
  on public.weekly_plans for insert
  with check (user_id = auth.uid());

create policy "plans owner update"
  on public.weekly_plans for update
  using (user_id = auth.uid());

create policy "plans owner delete"
  on public.weekly_plans for delete
  using (user_id = auth.uid());

-- Weekly plan items
create table if not exists public.weekly_plan_items (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  category text not null check (category in ('scales','review','new','technique')),
  target_minutes int not null default 0,
  note text
);

alter table public.weekly_plan_items enable row level security;

create policy "items owner select"
  on public.weekly_plan_items for select
  using (exists (select 1 from public.weekly_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy "items owner insert"
  on public.weekly_plan_items for insert
  with check (exists (select 1 from public.weekly_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy "items owner update"
  on public.weekly_plan_items for update
  using (exists (select 1 from public.weekly_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy "items owner delete"
  on public.weekly_plan_items for delete
  using (exists (select 1 from public.weekly_plans p where p.id = plan_id and p.user_id = auth.uid()));

-- Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push owner select"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push owner insert"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push owner delete"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

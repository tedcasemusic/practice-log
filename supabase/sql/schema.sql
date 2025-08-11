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

-- Practice sessions - simplified structure that matches the code
create table if not exists public.sessions (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users on delete cascade,
  session_date date not null,
  category text not null check (category in ('scales','review','new','technique')),
  minutes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ensure only one entry per user per category per day
  unique(user_id, session_date, category)
);

alter table public.sessions enable row level security;

create index if not exists sessions_user_date_idx on public.sessions (user_id, session_date);
create index if not exists sessions_user_category_idx on public.sessions (user_id, category);

create policy "sessions owner select"
  on public.sessions for select
  using (user_id = auth.uid());

create policy "sessions owner insert"
  on public.sessions for insert
  with check (user_id = auth.uid());

create policy "sessions owner update"
  on public.sessions for update
  using (user_id = auth.uid());

create policy "sessions owner delete"
  on public.sessions for delete
  using (user_id = auth.uid());

-- Weekly plans - simplified structure that matches the code
create table if not exists public.plan (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users on delete cascade,
  daily_goal int not null default 180,
  scales_minutes int not null default 45,
  scales_note text default '',
  review_minutes int not null default 45,
  review_note text default '',
  new_minutes int not null default 45,
  new_note text default '',
  technique_minutes int not null default 45,
  technique_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ensure only one plan per user
  unique(user_id)
);

alter table public.plan enable row level security;

create policy "plan owner select"
  on public.plan for select
  using (user_id = auth.uid());

create policy "plan owner insert"
  on public.plan for insert
  with check (user_id = auth.uid());

create policy "plan owner update"
  on public.plan for update
  using (user_id = auth.uid());

create policy "plan owner delete"
  on public.plan for delete
  using (user_id = auth.uid());

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

-- Function to automatically create daily entries for all categories
create or replace function ensure_daily_entries(user_uuid uuid, target_date date)
returns void as $$
begin
  -- Insert entries for all categories if they don't exist
  insert into public.sessions (user_id, session_date, category, minutes)
  select user_uuid, target_date, cat.category, 0
  from (values ('scales'), ('review'), ('new'), ('technique')) as cat(category)
  where not exists (
    select 1 from public.sessions 
    where user_id = user_uuid 
    and session_date = target_date 
    and category = cat.category
  );
end;
$$ language plpgsql security definer;

-- Trigger to automatically create daily entries when a user is created
create or replace function create_initial_plan()
returns trigger as $$
begin
  -- Create initial plan for new user
  insert into public.plan (user_id, daily_goal, scales_minutes, scales_note, review_minutes, review_note, new_minutes, new_note, technique_minutes, technique_note)
  values (new.id, 180, 45, 'Tone & Intonation', 45, 'Review Rep', 45, 'New Rep', 45, 'Technique');
  
  -- Create entries for today and yesterday for all categories
  perform ensure_daily_entries(new.id, current_date);
  perform ensure_daily_entries(new.id, current_date - interval '1 day');
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_user_created
  after insert on auth.users
  for each row
  execute function create_initial_plan();

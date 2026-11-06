-- Larson Live Stats: first cloud-sync schema
-- Run once in Supabase Dashboard > SQL Editor.
create table if not exists public.live_games (
  id text primary key,
  owner_id uuid not null references auth.users(id),
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.live_scoreboards (
  id text primary key references public.live_games(id) on delete cascade,
  home text not null,
  away text not null,
  home_score integer not null default 0,
  away_score integer not null default 0,
  period integer not null default 1,
  seconds integer not null default 480,
  running boolean not null default false,
  started_at bigint,
  home_color text,
  away_color text,
  updated_at timestamptz not null default now()
);
alter table public.live_games enable row level security;
alter table public.live_scoreboards enable row level security;
drop policy if exists "owners read games" on public.live_games;
create policy "owners read games" on public.live_games for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "owners create games" on public.live_games;
create policy "owners create games" on public.live_games for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "owners update games" on public.live_games;
create policy "owners update games" on public.live_games for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "anyone views public scoreboard" on public.live_scoreboards;
create policy "anyone views public scoreboard" on public.live_scoreboards for select to anon, authenticated using (true);
-- No direct insert/update/delete policies for public scoreboards.
create or replace function public.refresh_live_scoreboard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.live_scoreboards
  (id,home,away,home_score,away_score,period,seconds,running,started_at,home_color,away_color,updated_at)
  values (
    new.id,
    coalesce(new.state->>'home','HOME'),
    coalesce(new.state->>'away','AWAY'),
    coalesce((new.state->'scores'->>'home')::integer,0),
    coalesce((new.state->'scores'->>'away')::integer,0),
    coalesce((new.state->>'period')::integer,1),
    coalesce((new.state->>'seconds')::integer,480),
    coalesce((new.state->>'running')::boolean,false),
    nullif(new.state->>'startedAt','')::bigint,
    new.state->'colors'->>'home',
    new.state->'colors'->>'away',
    now()
  )
  on conflict (id) do update set
    home=excluded.home, away=excluded.away,
    home_score=excluded.home_score,away_score=excluded.away_score,
    period=excluded.period,seconds=excluded.seconds,
    running=excluded.running,started_at=excluded.started_at,
    home_color=excluded.home_color,away_color=excluded.away_color,
    updated_at=now();
  return new;
end;
$$;
drop trigger if exists sync_live_scoreboard on public.live_games;
create trigger sync_live_scoreboard after insert or update of state on public.live_games
for each row execute function public.refresh_live_scoreboard();
-- The overlay can subscribe to scoreboard changes without accessing private game events.
do $$ begin
  alter publication supabase_realtime add table public.live_scoreboards;
exception when duplicate_object then null;
end $$;

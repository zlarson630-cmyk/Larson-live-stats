-- Applied to Supabase project on 2026-11-07 as private_scheduled_games_v1.
create table if not exists public.scheduled_games (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 sport text not null check (sport in ('basketball','soccer','volleyball','baseball','softball','football','flag-football')),
 home text not null check (char_length(trim(home)) between 1 and 60),
 away text not null check (char_length(trim(away)) between 1 and 60),
 level text not null default '' check (char_length(level)<=40),
 venue text not null default '' check (char_length(venue)<=100),
 scheduled_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.scheduled_games enable row level security;
revoke all on public.scheduled_games from anon;
grant select,insert,delete on public.scheduled_games to authenticated;
create policy "schedule owner select" on public.scheduled_games for select to authenticated using (owner_id=(select auth.uid()));
create policy "schedule owner insert" on public.scheduled_games for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "schedule owner delete" on public.scheduled_games for delete to authenticated using (owner_id=(select auth.uid()));
create index if not exists scheduled_games_owner_date on public.scheduled_games(owner_id,scheduled_at);

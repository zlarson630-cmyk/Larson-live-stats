-- PROPOSAL ONLY. Do not apply until authenticated RLS and moderation tests pass.
-- Separate community submissions from existing official live_games.
create table if not exists public.community_games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id),
  sport text not null check (sport in ('basketball','soccer','volleyball','baseball','softball','football','flag-football')),
  home_name text not null check (char_length(trim(home_name)) between 1 and 100),
  away_name text not null check (char_length(trim(away_name)) between 1 and 100),
  scheduled_at timestamptz,
  level text,
  venue text,
  visibility text not null default 'pending' check (visibility in ('pending','published','hidden')),
  official_game_id text references public.live_games(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.community_score_reports (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.community_games(id) on delete cascade,
  reporter_id uuid not null references auth.users(id),
  home_score integer not null check (home_score between 0 and 9999),
  away_score integer not null check (away_score between 0 and 9999),
  period_label text,
  game_status text not null default 'live' check (game_status in ('scheduled','live','final')),
  created_at timestamptz not null default now()
);
create index if not exists community_games_lookup on public.community_games(sport,scheduled_at);
create index if not exists community_reports_game_latest on public.community_score_reports(game_id,created_at desc);
alter table public.community_games enable row level security;
alter table public.community_score_reports enable row level security;
-- Creators can submit a pending game, but cannot self-publish.
create policy "community creators insert pending" on public.community_games
  for insert to authenticated
  with check (creator_id=(select auth.uid()) and visibility='pending' and official_game_id is null);
create policy "community creators see own or published" on public.community_games
  for select to authenticated
  using (creator_id=(select auth.uid()) or visibility='published');
create policy "public sees published community games" on public.community_games
  for select to anon using (visibility='published');
-- Reports are append-only. Do not grant update or delete.
create policy "reporter inserts into published games" on public.community_score_reports
  for insert to authenticated
  with check (reporter_id=(select auth.uid()) and exists
    (select 1 from public.community_games g where g.id=game_id and g.visibility='published'));
create policy "reporter reads own reports" on public.community_score_reports
  for select to authenticated using (reporter_id=(select auth.uid()));
-- No public SELECT of raw reports until moderation/primary-source selection exists.
-- A reviewed SECURITY DEFINER function or server-side worker should control publishing,
-- throttling, reporter bans, disputes, and canonical scoreboard projection.
-- Never attach these tables to official scoreboard triggers without a separate security review.

-- Public read model. Existing private schedules, game state, and scorer access stay private.
create table public.game_center_games (
  id text primary key references public.live_games(id) on delete cascade,
  sport text not null check (sport in ('basketball', 'soccer', 'volleyball')),
  status text not null check (status in ('live', 'upcoming', 'final')),
  teams jsonb not null,
  home_score integer not null,
  away_score integer not null,
  period integer not null,
  scheduled_at timestamptz,
  final_at timestamptz,
  updated_at timestamptz not null
);
create index game_center_status_updated on public.game_center_games (status, updated_at desc, id);
create index game_center_upcoming on public.game_center_games (scheduled_at, id) where status = 'upcoming';
create index game_center_finals on public.game_center_games (final_at desc, id) where status = 'final';
alter table public.game_center_games enable row level security;
revoke all on public.game_center_games from public, anon, authenticated;
grant select on public.game_center_games to anon, authenticated;
create policy "Public Game Center read" on public.game_center_games for select to anon, authenticated using (true);

create function public.project_game_center(game public.live_games, previous_final timestamptz, changed_at timestamptz)
returns public.game_center_games
language sql stable set search_path = ''
as $$
  with input as (
    select game.state as s, coalesce(game.state->>'sport','basketball') as sport
  ), details as (
    select s, sport,
      case when pg_input_is_valid(s->>'scheduledAt','timestamp with time zone')
        then (s->>'scheduledAt')::timestamptz end as scheduled,
      case when pg_input_is_valid(s->>'finalAt','timestamp with time zone')
        then (s->>'finalAt')::timestamptz end as completed,
      coalesce((s->'scores'->>'home')::integer,0) as home_score,
      coalesce((s->'scores'->>'away')::integer,0) as away_score
    from input
  ), classified as (
    select *, case
      when game.legacy_ref is not null or sport not in ('basketball','soccer','volleyball')
        or s->>'libraryStatus' = 'trash' then null
      when s->>'libraryStatus' = 'completed' or s->>'finished' = 'true' then 'final'
      when s->>'liveStarted' = 'true' or s->>'running' = 'true'
        or home_score > 0 or away_score > 0 then 'live'
      when scheduled is not null then 'upcoming'
    end as status
    from details
  )
  select game.id, sport, status,
    (select jsonb_object_agg(side, jsonb_strip_nulls(jsonb_build_object(
       'name', left(coalesce(nullif(s->>side,''), initcap(side)),100),
       'conference', left(s->'teamBrands'->side->>'conference',80),
       'association', left(s->'teamBrands'->side->>'association',80)
    ))) from unnest(array['home','away']) as side),
    home_score, away_score, coalesce((s->>'period')::integer,1),
    scheduled, case when status = 'final' then coalesce(completed, previous_final, changed_at) end, changed_at
  from classified;
$$;
revoke execute on function public.project_game_center(public.live_games,timestamptz,timestamptz) from public, anon, authenticated;

-- Runs after an owner-authorized write and copies only the explicit public fields above.
create function public.sync_game_center()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  entry public.game_center_games;
begin
  entry := public.project_game_center(new, (select final_at from public.game_center_games where id=new.id), now());
  if entry.status is null then
    delete from public.game_center_games where id=new.id;
  else
    insert into public.game_center_games select entry.*
    on conflict (id) do update set
      sport=excluded.sport, status=excluded.status, teams=excluded.teams,
      home_score=excluded.home_score, away_score=excluded.away_score, period=excluded.period,
      scheduled_at=excluded.scheduled_at, final_at=excluded.final_at, updated_at=excluded.updated_at;
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_game_center() from public, anon, authenticated;
create trigger sync_game_center after insert or update of state on public.live_games
for each row execute function public.sync_game_center();

insert into public.game_center_games
select entry.*
from public.live_games as game
cross join lateral public.project_game_center(game, null, game.updated_at) as entry
where entry.status is not null;

-- Volleyball uses the Game Center link exclusively so unpublishing removes its public score.
drop trigger sync_live_scoreboard on public.live_games;
create trigger sync_live_scoreboard after insert or update of state on public.live_games
for each row when ((new.state->>'sport') is distinct from 'volleyball')
execute function public.refresh_live_scoreboard();

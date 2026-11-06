-- Add only soccer clock direction to the existing public projection. No policy changes.
alter table public.live_scoreboards add column if not exists clock_mode text not null default 'up';
create or replace function public.refresh_live_scoreboard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.live_scoreboards
  (id,home,away,home_score,away_score,period,seconds,running,started_at,home_color,away_color,clock_mode,updated_at)
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
    case when new.state->>'sport'='soccer' and new.state->>'clockMode'='down' then 'down' else 'up' end,
    now()
  )
  on conflict (id) do update set
    home=excluded.home, away=excluded.away,
    home_score=excluded.home_score,away_score=excluded.away_score,
    period=excluded.period,seconds=excluded.seconds,
    running=excluded.running,started_at=excluded.started_at,
    home_color=excluded.home_color,away_color=excluded.away_color,
    clock_mode=excluded.clock_mode,updated_at=now();
  return new;
end;
$$;

-- Trigger functions are not direct RPC endpoints.
revoke execute on function public.refresh_live_scoreboard() from public, anon, authenticated;

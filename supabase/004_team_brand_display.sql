create or replace function public.refresh_live_scoreboard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.live_scoreboards
  (id,home,away,home_score,away_score,period,seconds,running,started_at,home_color,away_color,clock_mode,logos,updated_at)
  values (
    new.id,
    coalesce(nullif(new.state->'teamBrands'->'home'->>'shortName',''),nullif(new.state->'teamBrands'->'home'->>'nickname',''),new.state->>'home','HOME'),
    coalesce(nullif(new.state->'teamBrands'->'away'->>'shortName',''),nullif(new.state->'teamBrands'->'away'->>'nickname',''),new.state->>'away','AWAY'),
    coalesce((new.state->'scores'->>'home')::integer,0),
    coalesce((new.state->'scores'->>'away')::integer,0),
    coalesce((new.state->>'period')::integer,1),
    coalesce((new.state->>'seconds')::integer,480),
    coalesce((new.state->>'running')::boolean,false),
    nullif(new.state->>'startedAt','')::bigint,
    new.state->'colors'->>'home',
    new.state->'colors'->>'away',
    case when new.state->>'sport'='soccer' and new.state->>'clockMode'='down' then 'down' else 'up' end,
    jsonb_build_object('home',coalesce(new.state->'logos'->>'home',''),'away',coalesce(new.state->'logos'->>'away','')),
    now()
  )
  on conflict (id) do update set
    home=excluded.home, away=excluded.away,
    home_score=excluded.home_score,away_score=excluded.away_score,
    period=excluded.period,seconds=excluded.seconds,
    running=excluded.running,started_at=excluded.started_at,
    home_color=excluded.home_color,away_color=excluded.away_color,
    clock_mode=excluded.clock_mode,logos=excluded.logos,updated_at=now();
  return new;
end;
$$;

-- Trigger functions are not direct RPC endpoints.
revoke execute on function public.refresh_live_scoreboard() from public, anon, authenticated;

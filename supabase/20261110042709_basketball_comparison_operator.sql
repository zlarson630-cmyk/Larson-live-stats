alter table public.basketball_broadcast_graphics
  drop constraint basketball_broadcast_graphics_kind_check,
  add constraint basketball_broadcast_graphics_kind_check check (kind in ('run','leader','comparison')),
  add column comparison jsonb check (comparison is null or (jsonb_typeof(comparison) = 'array' and octet_length(comparison::text) <= 4096));

create table public.basketball_graphic_operators (
  game_id text primary key references public.live_games(id) on delete cascade,
  invite_code uuid not null unique,
  operator_id uuid references auth.users(id) on delete set null
);
alter table public.basketball_graphic_operators enable row level security;
revoke all on public.basketball_graphic_operators from public, anon, authenticated;
grant select, insert, update, delete on public.basketball_graphic_operators to authenticated;

create policy "Game owners manage their operator seat" on public.basketball_graphic_operators
  for all to authenticated
  using (exists (select 1 from public.live_games where id = game_id and owner_id = (select auth.uid())))
  with check (exists (
    select 1 from public.live_games where id = game_id and owner_id = (select auth.uid())
    and coalesce(state->>'sport','basketball') = 'basketball'
    and state->>'libraryStatus' is distinct from 'trash'
  ));

create schema if not exists broadcast_private;
revoke all on schema broadcast_private from public, anon, authenticated;
grant usage on schema broadcast_private to authenticated;

create function broadcast_private.can_operate_basketball_graphics(game_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.basketball_graphic_operators as o
    join public.live_games as g on g.id = o.game_id
    where o.game_id = game_code and o.operator_id = (select auth.uid())
    and coalesce(g.state->>'sport','basketball') = 'basketball'
    and g.state->>'libraryStatus' is distinct from 'trash'
  );
$$;

create function broadcast_private.claim_basketball_operator_invite(game_code text, code uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  claimant uuid := auth.uid();
begin
  if claimant is null then return false; end if;
  update public.basketball_graphic_operators as o set operator_id = claimant
  from public.live_games as g
  where o.game_id = game_code and o.invite_code = code and g.id = o.game_id
    and g.owner_id <> claimant and (o.operator_id is null or o.operator_id = claimant)
    and coalesce(g.state->>'sport','basketball') = 'basketball'
    and g.state->>'libraryStatus' is distinct from 'trash';
  return found;
end;
$$;

create function broadcast_private.basketball_operator_comparison(game_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with game as (
    select g.state, s.home, s.away, s.home_score, s.away_score
    from public.live_games as g join public.live_scoreboards as s on s.id = g.id
    where g.id = game_code and broadcast_private.can_operate_basketball_graphics(game_code)
  ), shots as (
    select e->>'team' as side, e->>'kind' as kind, e->>'points' as points, e->>'assist' as assist
    from game, lateral jsonb_array_elements(case when jsonb_typeof(state->'events')='array'
      then state->'events' else '[]'::jsonb end) as e
    where e->>'kind' in ('score','miss')
  ), teams(side, sort_key) as (values ('away',0),('home',1)), totals as (
    select t.side,t.sort_key,
      count(*) filter (where points in ('2','3') and kind='score') as fgm,
      count(*) filter (where points in ('2','3')) as fga,
      count(*) filter (where points='3' and kind='score') as tpm,
      count(*) filter (where points='3') as tpa,
      count(*) filter (where points='1' and kind='score') as ftm,
      count(*) filter (where points='1') as fta,
      count(*) filter (where points in ('2','3') and kind='score' and assist ~ '^[0-9]{1,2}$') as ast
    from teams as t left join shots as s on t.side=s.side
    group by t.side,t.sort_key
  )
  select jsonb_agg(jsonb_build_object(
    'name', left(case side when 'home' then home else away end,100),
    'values', jsonb_build_array(
      case side when 'home' then home_score else away_score end,
      fgm||'–'||fga||case when fga>0 then ' ('||round(100.0*fgm/fga)||'%)' else '' end,
      tpm||'–'||tpa||case when tpa>0 then ' ('||round(100.0*tpm/tpa)||'%)' else '' end,
      ftm||'–'||fta||case when fta>0 then ' ('||round(100.0*ftm/fta)||'%)' else '' end,
      ast, state->'fouls'->side, state->'timeouts'->side
    )
  ) order by sort_key)
  from totals cross join game;
$$;

create function broadcast_private.take_basketball_operator_comparison(game_code text, show_graphic boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  stats jsonb;
begin
  if not broadcast_private.can_operate_basketball_graphics(game_code) then return false; end if;
  if show_graphic then
    stats := broadcast_private.basketball_operator_comparison(game_code);
    if stats is null then return false; end if;
    insert into public.basketball_broadcast_graphics (game_id, kind, position, headline, detail, comparison, expires_at)
    values (game_code, 'comparison', 'above', 'Team stats comparison', 'Basketball', stats, now()+interval '12 seconds')
    on conflict (game_id) do update set kind=excluded.kind, position=excluded.position, headline=excluded.headline,
      detail=excluded.detail, comparison=excluded.comparison, expires_at=excluded.expires_at, run_clock=null;
  else
    update public.basketball_broadcast_graphics set kind=null, headline=null, detail=null,
      comparison=null, run_clock=null, expires_at=now()+interval '12 seconds'
    where game_id=game_code and kind='comparison';
  end if;
  return true;
end;
$$;

revoke execute on all functions in schema broadcast_private from public, anon, authenticated;
grant execute on function broadcast_private.claim_basketball_operator_invite(text,uuid),
  broadcast_private.basketball_operator_comparison(text),
  broadcast_private.take_basketball_operator_comparison(text,boolean) to authenticated;

create function public.claim_basketball_operator_invite(game_code text, code uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select broadcast_private.claim_basketball_operator_invite(game_code,code);
$$;
create function public.basketball_operator_comparison(game_code text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select broadcast_private.basketball_operator_comparison(game_code);
$$;
create function public.take_basketball_operator_comparison(game_code text, show_graphic boolean)
returns boolean language sql security invoker set search_path = '' as $$
  select broadcast_private.take_basketball_operator_comparison(game_code,show_graphic);
$$;
revoke execute on function public.claim_basketball_operator_invite(text,uuid),
  public.basketball_operator_comparison(text), public.take_basketball_operator_comparison(text,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_basketball_operator_invite(text,uuid),
  public.basketball_operator_comparison(text), public.take_basketball_operator_comparison(text,boolean)
  to authenticated;
;
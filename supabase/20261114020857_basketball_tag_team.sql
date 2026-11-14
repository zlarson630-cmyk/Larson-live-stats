-- Limited second-device access. The game owner's usual RLS policies stay in place.
create schema if not exists basketball_private;
revoke all on schema basketball_private from public;
grant usage on schema basketball_private to anon, authenticated;

create function basketball_private.tag_team_exchange(
  game_code text, link_key uuid, play_id text, detail jsonb, expected jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  game jsonb;
  play jsonb;
  play_index integer;
  mode text;
  team text;
  jersey text;
  rebound_type text;
  location jsonb;
  fingerprint text;
  next_version numeric;
begin
  if game_code is null or game_code !~ '^[A-Z0-9]{6}$' or link_key is null then
    raise exception 'This Tag Team link is invalid or no longer active.';
  end if;
  fingerprint := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(link_key::text,'UTF8')),'hex');
  if detail is null then
    select g.state into game from public.live_games g
    where g.id = game_code and g.state #>> '{tagTeam,keyHash}' = fingerprint;
  else
    select g.state into game from public.live_games g
    where g.id = game_code and g.state #>> '{tagTeam,keyHash}' = fingerprint
    for update;
  end if;
  mode := game #>> '{tagTeam,mode}';
  if mode is null or mode not in ('details','chart')
     or coalesce(game->>'sport','basketball') <> 'basketball'
     or coalesce(game->>'libraryStatus','active') in ('trash','completed')
     or coalesce(game->>'finished','false') = 'true' then
    raise exception 'This Tag Team link is invalid or no longer active.';
  end if;
  if detail is not null then
    select e.value, (e.ordinality-1)::integer into play, play_index
    from pg_catalog.jsonb_array_elements(game->'events') with ordinality e
    where e.value->>'id'=play_id and e.value->>'team' in ('home','away')
      and e.value->>'kind' in ('score','miss') and e.value->>'points' in ('2','3');
    if play is null then raise exception 'That shot was removed or changed. Choose a shot from the list.'; end if;
    if jsonb_build_array(play->'kind',play->'team',play->'points',play->'scorer',
        play->'assist',play->'rebound',play->'shotLocation',play->'tagTeamDetail',play->'tagTeamNoRebound') is distinct from expected then
      raise exception 'That shot changed. Review the current play before saving.';
    end if;
    team := play->>'team';
    jersey := detail->>'player';
    rebound_type := detail->>'type';
    if mode='chart' then
      location := detail->'location';
      if jsonb_typeof(location->'x') is distinct from 'number'
         or jsonb_typeof(location->'y') is distinct from 'number'
         or (location->>'x')::numeric not between 0 and 50
         or (location->>'y')::numeric not between 0 and 47 then
        raise exception 'Choose a location on the court.';
      end if;
      play := play || jsonb_build_object('shotLocation',jsonb_build_object('x',location->'x','y',location->'y'));
    else
      if (play->>'tagTeamDetail' is distinct from 'assist' or play->>'kind' is distinct from 'score')
         and (play->>'tagTeamDetail' is distinct from 'rebound' or play->>'kind' is distinct from 'miss') then
        raise exception 'That shot is outside this operator’s assignments.';
      end if;
      if play->>'kind'='score' then
        rebound_type := null;
      else
        if rebound_type is null or rebound_type not in ('offensive','defensive','none') then
          raise exception 'Choose offensive, defensive, or no rebound.';
        end if;
        if rebound_type='defensive' then team := case team when 'home' then 'away' else 'home' end; end if;
      end if;
      if rebound_type is distinct from 'none'
         and (case when play->>'kind'='score' then jersey is distinct from 'no-assist' else jersey is distinct from 'team' end) then
        if jersey is null or jersey !~ '^[0-9]{1,2}$' or not exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(game->'rosters'->team,'[]'::jsonb)) p
          where p->>'number'=jersey
        ) then raise exception 'Choose a player from the roster.'; end if;
      end if;
      if play->>'kind'='score' then
        if jersey is not distinct from play->>'scorer' then raise exception 'The shooter cannot assist their own basket.'; end if;
        play := (play - 'pendingDetail') || jsonb_build_object('assist',jersey);
      elsif rebound_type='none' then
        play := (play - 'rebound' - 'pendingDetail') || jsonb_build_object('tagTeamNoRebound',true);
      else
        play := (play - 'tagTeamNoRebound' - 'pendingDetail') ||
          jsonb_build_object('rebound',jsonb_build_object('team',team,'type',rebound_type,'player',jersey));
      end if;
    end if;
    next_version := greatest(coalesce((game->>'version')::numeric,0)+1, floor(extract(epoch from clock_timestamp())*1000));
    game := jsonb_set(game,array['events',play_index::text],play)
      || jsonb_build_object('version',next_version);
    update public.live_games set state=game where id=game_code;
  end if;
  -- Return only the fields used at the second station. Keep scorer notes and link configuration private.
  return jsonb_build_object('mode',mode,'version',game->'version',
    'home',coalesce(game #>> '{teamBrands,home,displayName}',game->>'home','Home'),
    'away',coalesce(game #>> '{teamBrands,away,displayName}',game->>'away','Visitor'),
    'rosters',(select jsonb_object_agg(side, (select coalesce(jsonb_agg(
      jsonb_build_object('number',p->'number','name',p->'name')), '[]'::jsonb)
      from pg_catalog.jsonb_array_elements(coalesce(game->'rosters'->side,'[]'::jsonb)) p))
      from (values ('home'),('away')) teams(side)),
    'clockFormat',game->'clockFormat',
    'shots',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.value->'id','team',e.value->'team','kind',e.value->'kind',
      'period',e.value->'period','time',e.value->'time','points',e.value->'points',
      'scorer',e.value->'scorer','assist',e.value->'assist','rebound',e.value->'rebound',
      'shotLocation',e.value->'shotLocation','tagTeamDetail',e.value->'tagTeamDetail',
      'tagTeamNoRebound',e.value->'tagTeamNoRebound'
    ) order by e.ordinality desc)
    from pg_catalog.jsonb_array_elements(game->'events') with ordinality e
    where e.value->>'kind' in ('score','miss') and e.value->>'points' in ('2','3')
      and (mode='chart' or e.value->>'tagTeamDetail' in ('assist','rebound'))),'[]'::jsonb));
end;
$$;

create function public.basketball_tag_team(
  game_code text, link_key uuid, play_id text default null, detail jsonb default null, expected jsonb default null
) returns jsonb language sql security invoker set search_path = ''
as $$ select basketball_private.tag_team_exchange(game_code,link_key,play_id,detail,expected); $$;
revoke execute on function basketball_private.tag_team_exchange(text,uuid,text,jsonb,jsonb),
  public.basketball_tag_team(text,uuid,text,jsonb,jsonb) from public;
grant execute on function basketball_private.tag_team_exchange(text,uuid,text,jsonb,jsonb),
  public.basketball_tag_team(text,uuid,text,jsonb,jsonb) to anon, authenticated;

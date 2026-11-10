alter table public.basketball_broadcast_graphics
  drop constraint basketball_broadcast_graphics_kind_check,
  add constraint basketball_broadcast_graphics_kind_check
    check (kind in ('run','leader','comparison','intro','upcoming','standings'));

-- The existing bounded JSON array carries comparison rows or one full-screen payload.
create function broadcast_private.take_basketball_operator_screen(game_code text, screen_kind text, screen_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  screen_title text;
begin
  -- Serialize publishing with replacement or revocation of this game's operator seat.
  perform 1 from public.basketball_graphic_operators as o
    where o.game_id = game_code and o.operator_id = (select auth.uid()) for share;
  if not found or not broadcast_private.can_operate_basketball_graphics(game_code) then
    return false;
  end if;

  if screen_kind is null then
    update public.basketball_broadcast_graphics set kind=null, headline=null, detail=null,
      comparison=null, run_clock=null, expires_at=now()+interval '12 seconds'
      where game_id=game_code;
    return true;
  end if;

  screen_title := case screen_kind when 'intro' then 'Matchup intro'
    when 'upcoming' then 'Upcoming games' when 'standings' then 'Conference standings' end;
  if screen_title is null or jsonb_typeof(screen_data) is distinct from 'object'
    or octet_length(jsonb_build_array(screen_data)::text)>4096 then
    raise exception 'Invalid broadcast screen' using errcode='22023';
  end if;

  insert into public.basketball_broadcast_graphics (game_id, kind, position, headline, detail, comparison, expires_at)
  values (game_code, screen_kind, 'above', screen_title, 'Basketball', jsonb_build_array(screen_data), now()+interval '12 seconds')
  on conflict (game_id) do update set kind=excluded.kind, position=excluded.position, headline=excluded.headline,
    detail=excluded.detail, comparison=excluded.comparison, expires_at=excluded.expires_at, run_clock=null;
  return true;
end;
$$;
revoke execute on function broadcast_private.take_basketball_operator_screen(text,text,jsonb) from public, anon, authenticated;
grant execute on function broadcast_private.take_basketball_operator_screen(text,text,jsonb) to authenticated;

create function public.take_basketball_operator_screen(game_code text, screen_kind text, screen_data jsonb)
returns boolean language sql security invoker set search_path = '' as $$
  select broadcast_private.take_basketball_operator_screen(game_code,screen_kind,screen_data);
$$;
revoke execute on function public.take_basketball_operator_screen(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.take_basketball_operator_screen(text,text,jsonb) to authenticated;

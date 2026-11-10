create table public.basketball_broadcast_graphics (
  game_id text primary key references public.live_games(id) on delete cascade,
  kind text check (kind in ('run','leader')),
  position text not null check (position in ('above','below','side')),
  headline text check (char_length(headline) between 1 and 120),
  detail text check (char_length(detail) between 1 and 180),
  expires_at timestamptz not null,
  check (
    (kind is null and headline is null and detail is null)
    or (kind is not null and headline is not null and detail is not null)
  )
);

alter table public.basketball_broadcast_graphics enable row level security;
revoke all on public.basketball_broadcast_graphics from public, anon, authenticated;
grant select on public.basketball_broadcast_graphics to anon, authenticated;
grant insert, update on public.basketball_broadcast_graphics to authenticated;

-- OBS reads only explicitly published, short-lived graphics.
create policy "OBS reads active graphics" on public.basketball_broadcast_graphics
  for select to anon, authenticated using (expires_at > now());
create policy "Scorers read their graphics" on public.basketball_broadcast_graphics
  for select to authenticated using (exists (
    select 1 from public.live_games
    where id = game_id and owner_id = (select auth.uid())
  ));
create policy "Scorers publish their basketball graphics" on public.basketball_broadcast_graphics
  for insert to authenticated with check (
    expires_at between now() and now() + interval '25 seconds' and exists (
      select 1 from public.live_games where id = game_id and owner_id = (select auth.uid())
      and coalesce(state->>'sport','basketball') = 'basketball'
      and state->>'libraryStatus' is distinct from 'trash'
    )
  );
create policy "Scorers update their basketball graphics" on public.basketball_broadcast_graphics
  for update to authenticated
  using (exists (
    select 1 from public.live_games where id = game_id and owner_id = (select auth.uid())
  ))
  with check (
    expires_at between now() and now() + interval '25 seconds' and exists (
      select 1 from public.live_games where id = game_id and owner_id = (select auth.uid())
      and coalesce(state->>'sport','basketball') = 'basketball'
      and state->>'libraryStatus' is distinct from 'trash'
    )
  );

alter publication supabase_realtime add table public.basketball_broadcast_graphics;

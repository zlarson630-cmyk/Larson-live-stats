# Larson Live Stats

Basketball and soccer scoring with private scorer state, public OBS scoreboards, and a reusable Team Brands library.

App: https://zlarson630-cmyk.github.io/Larson-live-stats/

## Supabase setup

1. For a new database, apply the SQL files in `supabase/` in order. The configured project already has the cloud library and shared brands migration.
2. In Supabase Authentication, enable the Email provider and create a scorer user with an email/password. Confirm the account if email confirmation is enabled. This app provides sign-in, not public sign-up or password reset; manage scorer accounts in Supabase.
3. Sign in on the app with that account and create a game. The creating account owns the game. Use that same account on another browser to continue scoring the game by ID. Other accounts and signed-out visitors only see the public scoreboard.
4. Keep GitHub Pages serving the repository's main branch. Wait for the Pages deployment after changes, then refresh the app.

`live.js` includes only the project's public URL and publishable key. Never add a service-role key, secret key, or scorer password. Supabase Row Level Security, not hidden controls, enforces write access. Public viewers use a separate client without a stored scorer session. Public scoreboards contain team names, scores, colors, period and clock; rosters, player events and assignments stay private to the owner. Public games should contain information intended for broadcast.

## Test across browsers and OBS

1. Browser A: sign in, create a cloud game, note its six-character ID. Score points, assign a scorer/assist, record fouls/timeouts, undo, change period, start/stop/set the clock. Roster seasons and PDF imports remain available; season rosters and each game’s roster snapshot are private to the account in the cloud.
2. Browser B (private window, signed out): open `?game=ABC123` using your real game ID. Scores and clock update; scoring and game controls are disabled. Player events and leaders are private and therefore absent here. Sign in as a different account and confirm it still cannot score this game.
3. Browser B: sign in as the creating account and rejoin. Game Flow, assignments and scoring should work. Make quick scoring updates from both signed-in browsers; the app serializes each browser's saves and retries compare-and-swap conflicts against the latest cloud state.
4. Broadcaster tab: open **OBS score bug preview**, copy the resulting `overlay.html?game=ABC123` URL into an OBS **Browser Source**. Suggested size: 1920 × 1080. The background is transparent; no sign-in is needed in OBS. Do not use a local file source. Hide/show or refresh the source and confirm it reloads the current score.
5. Disconnect/reconnect a viewer: it keeps the last score, shows a connection message, and catches up on reconnect. Realtime notifications trigger a fresh read; a three-second poll also covers missed notifications. The running clock is calculated from the stored start time, so it advances locally between messages. Keep device clocks synchronized.
6. Disconnect the scorer and attempt a change: it must report **Not saved** without adding an unconfirmed score. Reconnect, wait for refresh, then retry that action. Cloud writes are not queued for later offline replay.
7. To bring in older browser records, open **My Profile** in their original browser and choose **Import older records to my account**. Imports keep existing cloud records and are safe to retry.

## Verification

Run `node --test tests/*.test.cjs` (Node 20+). These tests exercise the actual app scripts with simulated browser/Supabase interfaces: cloud scoring, season roster reuse, brand sharing and legacy import, conflict retries, sequential saves, read-only enforcement, failed saves, and subscription reconnect/poll cleanup.

Live endpoint verification during implementation: public scoreboard SELECT returned 200; anonymous private SELECT returned no rows; anonymous inserts into both `live_games` and `live_scoreboards` were denied by RLS (401 / 42501). No authenticated scorer credentials were supplied, so real signed-in writes, realtime delivery and OBS rendering still require the manual test above. No test game was inserted by the anonymous checks.

Supabase API references: https://supabase.com/docs/reference/javascript/auth-signinwithpassword and https://supabase.com/docs/guides/realtime/postgres-changes

## Reusable Team Brands

Open `brands.html` to save team/school names, nicknames, short names, logos and whites/primary uniform schemes and an optional alternate. Upload PNG/JPG/WebP logos or use HTTPS image links. Select a saved team and uniform in either sport’s setup. The library is stored in your account. Use Share brand to make a visual identity available in Discover shared brands; other users can add an independent copy. Export/import JSON is available for backups. Games retain brand snapshots.

Soccer shots on goal create a linked save for the other team. Set each current goalkeeper in setup or under **Goalkeepers and team logos**; update it after a keeper substitution. Without a designated keeper, the event form offers the opponent roster. Goals do not create saves. Edit/delete/undo keeps linked shots and saves together.

The connected database has the public display updates in `supabase/002_soccer_clock.sql`, `003_soccer_logos.sql`, and `004_team_brand_display.sql`. New database installations should apply them after `001_live_games.sql`. Public display metadata contains logos and compact names; rosters and goalkeeper assignments stay in private game state.

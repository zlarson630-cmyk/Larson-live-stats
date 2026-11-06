# Larson Live Stats

Basketball scoring with private scorer state and a public, read-only OBS scoreboard.

App: https://zlarson630-cmyk.github.io/Larson-live-stats/

## Supabase setup

1. Run `supabase/001_live_games.sql` in the project's SQL Editor (already completed for the configured project). No additional migration is needed for this update.
2. In Supabase Authentication, enable the Email provider and create a scorer user with an email/password. Confirm the account if email confirmation is enabled. This app provides sign-in, not public sign-up or password reset; manage scorer accounts in Supabase.
3. Sign in on the app with that account and create a game with **Local only** unchecked. The creating account owns the game. Use that same account on another browser to continue scoring the game by ID. Other accounts and signed-out visitors only see the public scoreboard.
4. Keep GitHub Pages serving the repository's main branch. Wait for the Pages deployment after changes, then refresh the app.

`live.js` includes only the project's public URL and publishable key. Never add a service-role key, secret key, or scorer password. Supabase Row Level Security, not hidden controls, enforces write access. Public viewers use a separate client without a stored scorer session. Public scoreboards contain team names, scores, colors, period and clock; rosters, player events and assignments stay private to the owner. Public games should contain information intended for broadcast.

## Test across browsers and OBS

1. Browser A: sign in, create a cloud game, note its six-character ID. Score points, assign a scorer/assist, record fouls/timeouts, undo, change period, start/stop/set the clock. Roster seasons and PDF imports remain available; season libraries remain browser-local and each game's roster snapshot is stored privately in its cloud state.
2. Browser B (private window, signed out): open `?game=ABC123` using your real game ID. Scores and clock update; scoring and game controls are disabled. Player events and leaders are private and therefore absent here. Sign in as a different account and confirm it still cannot score this game.
3. Browser B: sign in as the creating account and rejoin. Game Flow, assignments and scoring should work. Make quick scoring updates from both signed-in browsers; the app serializes each browser's saves and retries compare-and-swap conflicts against the latest cloud state.
4. Broadcaster tab: open **OBS score bug preview**, copy the resulting `overlay.html?game=ABC123` URL into an OBS **Browser Source**. Suggested size: 1920 × 1080. The background is transparent; no sign-in is needed in OBS. Do not use a local file source. Hide/show or refresh the source and confirm it reloads the current score.
5. Disconnect/reconnect a viewer: it keeps the last score, shows a connection message, and catches up on reconnect. Realtime notifications trigger a fresh read; a three-second poll also covers missed notifications. The running clock is calculated from the stored start time, so it advances locally between messages. Keep device clocks synchronized.
6. Disconnect the scorer and attempt a change: it must report **Not saved** without adding an unconfirmed score. Reconnect, wait for refresh, then retry that action. Cloud writes are not queued for later offline replay.
7. Check **Local only** to create/join original browser-local games, including games saved before this change. They use local storage and BroadcastChannel. Their preview URL includes `&local=1`. OBS has separate browser storage, so use a cloud game for OBS and cross-device use. Cloud failures never silently convert an existing game into a divergent local game.

## Verification

Run `node --test tests/live.test.cjs` (Node 20+). These tests exercise the actual app scripts with simulated browser/Supabase interfaces: local score/assignment/foul/undo/clock, conflict retries, sequential saves, read-only enforcement, failed saves, and subscription reconnect/poll cleanup.

Live endpoint verification during implementation: public scoreboard SELECT returned 200; anonymous private SELECT returned no rows; anonymous inserts into both `live_games` and `live_scoreboards` were denied by RLS (401 / 42501). No authenticated scorer credentials were supplied, so real signed-in writes, realtime delivery and OBS rendering still require the manual test above. No test game was inserted by the anonymous checks.

Supabase API references: https://supabase.com/docs/reference/javascript/auth-signinwithpassword and https://supabase.com/docs/guides/realtime/postgres-changes

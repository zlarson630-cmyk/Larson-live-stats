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


## Multisport beta routes (November 2026)

- `home.html`: unified navigation. The existing `index.html` remains the basketball entry point.
- `quick-game.html`: sport launcher. Basketball and soccer retain their existing setup; volleyball accepts team-name prefill.
- `volleyball.html`: local-only event-replay scoring beta, timeouts, explicit player stats, undo and validated JSON export/import. **Not cloud synchronized, not verified official stats.**
- `schedule.html`: browser-local drafts with duplicate warnings and JSON export/import, plus authenticated owner-private Supabase scheduling (`scheduled_games`) and explicit local-draft upload. Cloud schedules are not public, and signed-in cross-device behavior still needs manual testing.
- `games.html`: read-only recent public scoreboard directory, limited to the 40 most recently updated records, with team search and 30-second refresh. The existing public table does not contain sport or official verification state; directory links now open the read-only sport-neutral `view.html` page; sport-specific labels and clock semantics still require a sport-aware public projection.
- `shared/game-identity.cjs`: conservative possible-duplicate matching. It never merges records automatically.
- `supabase/PROPOSAL_community_scoring.sql`: **not applied**. Community reporting and moderation are not active.

GitHub Actions runs `node --test tests/*.test.cjs` on pushes and PRs. Verify workflow results before relying on a release. Before a production community-scoring rollout, design the public sport-aware game registry, rate limits, moderation, canonical source selection, official claim workflow, and RLS tests.


### Private cloud scheduling (migration 005)

The `scheduled_games` table is deployed with owner-scoped SELECT, INSERT and DELETE policies and no anonymous access. Sign in on `schedule.html`, use **Upload local drafts**, and load the private schedule on a second device using the same account. Local drafts are intentionally retained. Verify another account cannot read/delete entries, anonymous reads fail, duplicate review works, and a failed upload reports partial progress. Cloud schedules are not yet the canonical public game registry and do not grant scorer permissions.

## Home Game Center

Home shows Larson Live Stats public games. The default is My Teams, using saved account brands or Jefferson when the library is empty. Conference and association scopes come from editable brand affiliations, with NIC-10 and IHSA as the Jefferson defaults. Unbranded NIC-10 team names are matched against the member-school list. Scope choices are remembered per account on the current browser.

In Basketball or Soccer setup, enter an optional **Public scheduled start** before creating the cloud game. Starting the clock or recording a score moves it into Live. Use the sport's existing final action to finish it. In Volleyball, sign in through My Profile and use **Publish scoreboard**. Publish a scheduled start or a match that has begun, then keep scoring on the same device to update public sets won. Completed volleyball matches publish as finals automatically. Player stats remain on the scorer's device.

The public feed uses the allowlisted projection in `supabase/008_game_center.sql`. It refreshes every five seconds and shows upcoming games and finals within seven days. Live entries leave the home feed after 12 hours without an update. Private schedules and legacy imports are excluded.

## Football, baseball and softball betas

Open a sport from Home and create a game. Use one scorer tab and keep its Broadcast Center open in another tab in the same browser. Broadcast links reference the saved game on that device. Export a branded PDF box score from either view.

- Football includes the game clock, quarter and overtime progression, manual down and distance, scoring plays, and separately entered passing, rushing, receiving, and defensive stats.
- Baseball and softball include inning line scores, pitch counts, outs, occupied bases, batting, and pitcher totals. Check the suggested runner movements and edit runs, RBI, outs and occupied bases before saving each play. The scorer advances the half after three outs and marks final when appropriate for the competition.
- Player stats include plays entered with a player or pitcher identifier. Team totals include all recorded plays. The betas save to this browser and do not publish to the public Game Center.

# Archived chat handoff — 2026-11-07 — Original Supabase setup discussion

Scope: Early Larson Live Stats basketball scoring and Supabase onboarding. This chat is being retired in favor of 2–3 active development chats. **Historical snapshot only**; consult the current README and implementation.

## Repository state reviewed
- Current README documents basketball **and soccer**, Supabase authenticated scoring, public read-only scoreboards, roster and brand libraries, OBS overlay, migrations through `supabase/004_team_brand_display.sql`, and Node tests.
- Current README says real signed-in scorer writes, realtime delivery and OBS rendering still need manual verification with credentials and a real test game.
- Earlier messages in this chat saying "Supabase isn't connected" were accurate at the time but are **superseded** by newer repository work. Do not reopen that work merely because of this chat.

## Decisions worth retaining
- Cross-browser scoring and OBS display are core product goals: phone scorer, separate browser/OBS read-only viewer, no manual refresh.
- Keep scorer authorization separate from public display data; never expose private roster or play-event details through the public scoreboard.
- Preserve season-specific rosters, mobile scoring workflow, player/assist selection, fouls, timeouts, clock, undo and game flow during cloud changes.
- User wants short-lived development chats with durable handoffs in GitHub; current repository takes precedence over old chat recollections.

## Already implemented / superseded
- Supabase project and first SQL migration were created; user confirmed the SQL editor reported success.
- Subsequent README describes account sign-in, owner-only game state, public scoreboards, cloud game rejoin, overlay updates and automated test coverage.
- An early warning about `DROP POLICY IF EXISTS` and `DROP TRIGGER IF EXISTS` in SQL was resolved during setup; not an outstanding bug.
- Original cloud-sync handoff was initiated in a separate Work chat; this archival record does not establish whether any particular live manual test was performed.

## Open verification candidates (not confirmed bugs)
1. With a real authorized scorer account, verify a basket scored on a phone updates a signed-out browser and OBS browser source promptly.
2. Test rejoining the same game on another authorized browser, including player selection, assist, foul, timeout, period, clock and undo.
3. Verify signed-out and non-owner accounts cannot edit, and private player data stays inaccessible to public viewers.
4. Test disconnected scorer save failure and reconnect recovery without silent lost or duplicate scores.
5. Run `node --test tests/*.test.cjs` on the current revision; inspect any failing tests before creating new issues.

## Next actions
- Use the current README test plan and newer handoffs to determine what remains unverified.
- Record actual manual test results and reproducible bugs in a **new** handoff or canonical issue tracker.
- Do not downgrade the project to the state described by this early chat.

## Verification and limits
Reviewed the current GitHub README and original `supabase/001_live_games.sql` through the connected GitHub tool. Did not run the application, inspect all source files, run tests, or verify Supabase dashboard state in this archival pass.

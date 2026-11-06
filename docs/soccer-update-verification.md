# Soccer scorer and report update

The scorer displays both teams' ten event controls in adjacent columns at all widths. Tapping an event selects its team and roster. Player/assist entry, time corrections, edit/delete/undo, clock controls, saved matches and broadcaster/overlay links retain their existing state format. Finished matches accept corrections without reopening new event entry.

The report uses bundled OFL-licensed Barlow and Barlow Condensed fonts, with a Helvetica fallback if font loading fails. It includes a branded score header, team comparison, scoring summary, player tables (including roster players without events), and complete game flow. Tables wrap long content, repeat headers across pages, and include page numbers. It labels unfinished games as in progress. The scorer supports count-up and countdown clocks with configurable 1–180 minute halves (40 by default). New matches default to countdown; legacy saved games keep count-up behavior. Countdown pauses at zero and requires Set time or Next period before restarting. Next period resets to the configured duration. Applying clock settings pauses the clock and preserves elapsed time and existing event timestamps. Each event retains its mode, half duration and elapsed-time ordering for accurate mixed-mode reports. The broadcaster and OBS use the same clamped clock calculation.

## Validation

Run `node --test tests/*.test.cjs` from the repository root. The basketball harness now supplies browser timer and querySelectorAll stubs used by the current app. Basketball production files, shared styles, cloud code, and broadcast/overlay pages are unchanged.

Browser checks: scored a home goal with player and assist, recorded an opposing goalkeeper save with the correct roster, resumed the saved game, and successfully downloaded a PDF. Checked adjacent columns at 375 px and desktop width; at 375 px document width equals viewport width and every event button is at least 48 px tall.

PDF QA: generated and rendered a two-page sample with bundled fonts; reviewed score, tables, section placement, and pagination. Generated a 30-page stress report containing long team names, a 65-player roster, and 150 events (plus all event players/assists); checked retained content and repeated table headers. Automated PDF checks also exercise font-loading fallback and page boundaries.

Live authenticated cloud scoring and OBS were not exercised with scorer credentials. Their production code and match-state format are unchanged.

## Countdown release validation

All 15 automated tests passed, including countdown start/pause/resume/expiry, halftime reset, mode conversion, legacy saved games, event corrections and ordering, invalid lengths, read-only guards, and broadcaster/public OBS countdown rendering. The cloud scoreboard migration in `supabase/002_soccer_clock.sql` was applied to the connected project; a rolled-back database test verified soccer countdown projection and unchanged basketball projection. No test match remains.

Browser follow-up confirmed a new 40:00 countdown, running and paused remaining time, matching broadcaster/OBS countdowns, and both teams’ goals labeled with remaining time. The security advisor reported only the existing account setting for disabled leaked-password protection; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. No authentication settings were changed.

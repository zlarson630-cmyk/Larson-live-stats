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

## Linked shots, branded broadcasts, and reusable teams

Non-goal shots on goal create a linked opposing save in one write. A designated current keeper is prefilled, otherwise the opponent roster is offered; the scorer can override or leave the player unassigned. Goals never create saves. Edit either linked event to correct the pair; delete or undo either removes both. Existing standalone saves remain unchanged, and old unlinked shots are not backfilled unless edited. Update the current keeper explicitly after a substitution.

Team Brands (`brands.html`) is a device-local reusable library shared by basketball and soccer. It stores team/school name, nickname, short name, logo, whites, primary, and optional alternate jersey/lettering/accent colors. Logo uploads are resized raster images; HTTPS image links are also supported. Export/import moves the library between devices. Setup pickers apply saved identities and uniform colors; each game stores its own brand snapshot. Full names appear in scoring/reports; short names or nicknames appear in compact OBS graphics. Brand edits do not rewrite existing games.

Broadcaster and both OBS panels use white/gray/red styles with logo slots and initials fallback. OBS canvases remain transparent. Public projection includes display logos and compact names only, preserving private rosters and keeper assignments. `003_soccer_logos.sql` adds the logo projection; `004_team_brand_display.sql` extends it to reusable brands across both sports.

Release validation: 24 automated checks passed across basketball, soccer, linked shots/saves, clock behavior, report ordering, team-library CRUD/export/import, logo validation, kit selection, and immutable game snapshots. Desktop browser QA uploaded a test PNG logo, saved a sample team, reused whites in soccer and primary colors in basketball, and verified the logo and nickname in the broadcaster. The browser viewport override did not apply to the new brand tabs; responsive CSS is present, but a phone-sized brand-builder screenshot was not verified in this environment. OBS panel white background and transparent document/body were verified through computed browser styles.

Optional alternate uniform: a third saved jersey/lettering/trim scheme can be enabled per team, previewed, exported/imported, and selected in both sports. Teams without an alternate keep only whites and primary options. Browser QA saved and reloaded a configured alternate.

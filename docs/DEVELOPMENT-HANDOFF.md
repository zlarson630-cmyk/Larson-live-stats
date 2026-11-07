# Larson Live Stats — Development Handoff Archive
Updated: 2026-11-07
App: https://zlarson630-cmyk.github.io/Larson-live-stats/
Repository: https://github.com/zlarson630-cmyk/Larson-live-stats
Latest basketball V0.4 release: df4d7639c8a2fc1e94d0890c89b0daf9cb7c199d

## Protocol for future chats
Read this file, README.md and recent main commits before making changes. Verify current code and deployment rather than trusting chat summaries. Keep decisions, feature status, bugs, untested behavior, ideas and exact next steps here. On every requested handoff, update this GitHub file. Preserve basketball, soccer, brands, cloud security and OBS. Run available tests and distinguish code checks from real-device verification.

## Product decisions
- Commercially scalable neutral Larson Live Stats branding, not Jefferson-specific.
- Game-specific jersey colors dominate team scoreboard panels, scoring controls, broadcaster tables; permanent team colors stored separately as accents.
- Illustrator/SVG scoreboard art can provide a visual shell; app drives logos, scores, foul/timeout dots and animations.
- Broadcaster Center is for announcers; public OBS scoreboard is separate.
- Basketball jersey numbers have digits 0–5 only: 0–5, 10–15, 20–25, 30–35, 40–45, 50–55.
- Keep action-first scoring and both teams accessible without switching team tabs.

## Implemented through V0.4
- Basketball made/missed 1/2/3 point shots, scorer/assist assignment, periods, clock, possession, team fouls/timeouts, undo, Game Flow.
- Season rosters, roster PDF import, team brands, Supabase private authenticated scoring/public scoreboard, OBS overlay.
- Broadcaster Center: score/clock, player PTS/FG/3PT/FT/AST, team comparison, recent plays, scoring runs and quick facts.
- Broadcaster player tables have full-width jersey-color bars; comparison is split half-and-half by team.
- Mobile picker legal jersey number fallback, larger targets, feedback while selection saves.
- V0.4 scoring feedback, rapid duplicate scoring tap protection, edit/remove plays with score recalculation.
- V0.4 main commit df4d7639c8a2fc1e94d0890c89b0daf9cb7c199d.

## Bugs, concerns and testing
- User previously found player selection after scoring sometimes unresponsive. V0.4 attempts to fix; NOT yet verified on real iPhone.
- Mobile caching previously showed old Broadcaster tab after GitHub commit. Confirm GitHub Pages deployment and cache-bust before diagnosing missing features.
- Need real iPhone + second browser test: sign-in, cloud game creation, score/miss, player selection, assists, corrections, undo, fouls, timeouts, clock, reconnect, OBS overlay.
- Test rapid taps, cloud save latency/failure, conflicting two-browser edits and game flow corrections. Do not show unsaved actions as saved.
- Full Node regression suite (README: node --test tests/*.test.cjs) not run in V0.4 chat; syntax and targeted correction tests passed.
- Existing broadcaster dashboard is in index.html; an unused broadcaster.js was created on an earlier feature branch, not necessarily production.
- No full individual fouls, rebounds, steals, blocks, turnovers or substitutions yet; do not fabricate zeroes for untracked categories.
- Supabase cloud writes are not queued for offline replay (see README).

## Next priorities
1. Complete V0.4 real-device and cross-browser/cloud/OBS regression tests; fix observed bugs.
2. Build full basketball stat-entry workflow with individual fouls, rebounds, steals, blocks, turnovers, substitutions and corrections.
3. Broadcast SVG/Illustrator scoreboard graphics with logos, timeout dots, foul/scoring slide-out animations.
4. Branded basketball final box-score PDF and game reports.
5. Soccer follow-up: countdown option, action-first dual-team controls and attractive branded stats PDF.
6. Continue refining broadcaster desktop layout after actual browser testing.

## Next-chat instruction
Open docs/DEVELOPMENT-HANDOFF.md and README.md in GitHub, inspect latest main commits, check deployment, then continue with V0.4 verification. Keep this archive updated at the end of the next development session.

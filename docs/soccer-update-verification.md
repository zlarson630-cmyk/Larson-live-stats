# Soccer scorer and report update

The scorer displays both teams' ten event controls in adjacent columns at all widths. Tapping an event selects its team and roster. Player/assist entry, time corrections, edit/delete/undo, clock controls, saved matches and broadcaster/overlay links retain their existing state format. Finished matches accept corrections without reopening new event entry.

The report uses bundled OFL-licensed Barlow and Barlow Condensed fonts, with a Helvetica fallback if font loading fails. It includes a branded score header, team comparison, scoring summary, player tables (including roster players without events), and complete game flow. Tables wrap long content, repeat headers across pages, and include page numbers. It labels unfinished games as in progress. This update retains the existing count-up clock.

## Validation

Run `node --test tests/*.test.cjs` from the repository root. The basketball harness now supplies browser timer and querySelectorAll stubs used by the current app. Basketball production files, shared styles, cloud code, and broadcast/overlay pages are unchanged.

Browser checks: scored a home goal with player and assist, recorded an opposing goalkeeper save with the correct roster, resumed the saved game, and successfully downloaded a PDF. Checked adjacent columns at 375 px and desktop width; at 375 px document width equals viewport width and every event button is at least 48 px tall.

PDF QA: generated and rendered a two-page sample with bundled fonts; reviewed score, tables, section placement, and pagination. Generated a 30-page stress report containing long team names, a 65-player roster, and 150 events (plus all event players/assists); checked retained content and repeated table headers. Automated PDF checks also exercise font-loading fallback and page boundaries.

Live authenticated cloud scoring and OBS were not exercised with scorer credentials. Their production code and match-state format are unchanged.

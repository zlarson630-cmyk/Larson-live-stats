# Product decisions and rationale — 2026-11-07

## Status language
- Discussed: explored, no commitment to implement.
- Requested: user explicitly asked for feature or fix.
- Implemented: present in current repository; not proof of successful use.
- Tested: user or repeatable test explicitly confirmed behavior. Manual verification may remain outstanding.
Do not close issues solely because code exists.

## Product north star
Fast, accurate, simple live scoring and media-ready reports first. Broadcast automation and premium polish later. Do not redesign already established workflows. Preserve both teams on one scoring screen, event-first player selection, instant feedback, no separate Save click, undo and corrections, and automatic cloud persistence with visible error state. No fabricated statistics.

## Modes and staffing
Basic and Advanced are configurations of the same event model, not separate engines. Basic should minimize novice workload: makes, made FTs, personal fouls, timeouts, period; optional misses. Advanced supports complete box-score capture. Distinguish untracked categories from actual zero. A beginner two-person crew can use caller + inputter; experienced crews may split scoring/fouls vs missed shots/rebounds and additional events. Do not default to splitting home and visitor. Tradeoff: a full box score is valuable but not at the expense of reliable scoring.

## Data, permissions, and collaboration
Cloud is authoritative; browser-only storage is not the desired long-term source of truth. Preserve account-owned team brands, season rosters, games, reusable/shared brand copies, and public read-only scoreboards. A single authoritative game record avoids duplicate results; separate authorized roles and conflict/duplicate handling are needed for future simultaneous operators. Public display should not leak private roster or player-event data unintentionally. README documents no offline write queue; avoid claiming offline saves.

## Presentation and brand
Neutral, commercially reusable Larson brand, not Jefferson/J-Hawk branding. Barlow for UI/tables; Barlow Condensed ExtraBold Italic uppercase athletic headers; light-gray/white background, charcoal text, restrained red emblem. The desired logo is the rounded nine-sided Z emblem, not the wordmark; verify fidelity rather than assume CSS polygon is final art. Permanent team brand colors separate from game-specific jersey colors. Jersey color dominates scoring/scorebug; brand colors are accents. Home remains right in permanent reports, even when on-screen team sides switch for direction of play. PDF exports should reflect brand and statistical completeness.

## Soccer-specific
Both teams directly accessible, event-first flow. A shot on goal saved by goalkeeper should link to an opponent save; goals do not create saves. Goalkeeper assignment can change. Cross vs shot ambiguity requires clear operator guidance; avoid treating all crosses as official shots. Substitutions should be staged then confirmed; injury timeouts and halftime direction switching were requested. Countdown option requested. Test the previously reported nonfunctional lower half. Soccer PDF was user-confirmed exportable, not approved visually.

## Basketball-specific
Respect legal high-school jersey numbers (0–5, 10–15, etc.). Stage substitutions for confirmation at scorer's table. Fast picker must register touches reliably; linked actions and edits must survive cloud saves. Injury timeouts and switchable screen sides requested. Broadcaster tables should reflect team/uniform colors, player stats and balanced team comparisons. Do not mistake code presence for game-day verification.

## Broadcast and conference: future, deliberately deferred
Game Center remains minimal. Broadcast Studio is a separate interface/session consuming the same canonical game events; zero, one, or several broadcasts can attach to a game. Start with OBS browser overlays, pregame matchups, player spotlights and team comparisons; later Illustrator templates, show control, motion graphics, and Stream Deck. Around-the-League aggregates simultaneous conference home games without requiring schools to broadcast; provisional scores must not be presented as verified finals. Test two games before scaling to five or ten. Main tradeoff: keep entry effortless for most schools while permitting advanced production for one or two broadcasters.

## Account, profile and brand decisions

- The user first requested a clear sign-in indicator and one place for teams, brands, rosters and past games. They later requested cloud storage across devices and a way for other users to add prebuilt brands. The original account/device split could hide older brands, and the library was below the editor. The account now owns new saves, and the brand shelf appears before the editor.
- Older browser records need an explicit import from their original browser. Preserve the cloud record when a matching brand or roster exists, skip duplicate game imports, and keep the browser originals as a backup. This protects existing work when an import is retried or interrupted.
- Sharing is opt-in per brand. Publish a snapshot of the visual identity, and let another user save an independently editable copy. This lets users reuse a prebuilt identity without linking their edits to its author. Stop sharing removes it from discovery, while recipients keep their copies. Rosters and detailed game history remain private. Imported games follow the existing public scoreboard behavior.
- Use one account across devices to continue scoring or see the same library. Distinct operators with separate editing permissions are future collaboration work in #6. The cloud library needs a connection to save. Scorers should see an explicit failure and retain the last confirmed game state when a save fails.

### Verification record

| Item | Evidence | Remaining check |
| --- | --- | --- |
| My Profile and sign-in indicator | Deployed. Earlier signed-in browser check displayed six saved games. | Verify the expanded cloud library in a second browser. |
| Brand shelf and discovery | Deployed and visually checked while signed out. Automated tests cover the complete shelf, independent shared copies, and stopping discovery. Database permissions were checked in a rolled-back production transaction. | Retest the originally reported missing brands using the original browser and verify sharing with two real accounts. See #9. |
| Cloud rosters, games and older-record import | Implemented for basketball and soccer. All 40 release tests passed, including simulated cloud saves, cross-device roster reuse, import retry and ownership checks. | Confirm actual legacy import counts and signed-in production behavior. See #9 and #5. |

## Current evidence and open verification
README documents Supabase-backed basketball/soccer, OBS scoreboard, account brands, goalkeeper linked saves, RLS, and simulated tests. index.html includes player picker, game flow, broadcaster tab, staged substitutions, screen-side switch. athletic-ui.css loads Barlow. User confirmed soccer PDF export worked, though aesthetics were rejected. Signed-in scorer writes, realtime delivery and OBS rendering still need end-to-end checks with the deployed app. Treat other reported fixes as unverified until tested.

## Issue index
#4 basic/advanced completeness; #5 cloud reliability; #6 multi-operator; #7 soccer; #8 basketball; #9 profile/brands; #10 reports; #11 broadcast/conference future.

## Chat and issue management workflow — 2026-11-07
- Keep one ChatGPT Project for Larson Live Stats; use chats organically rather than requiring a fixed chat-per-sport structure or manual folders. Reason: the organizational overhead distracts from building and testing the product.
- GitHub Issues are the durable, centralized backlog. During chat audits, distinguish discussed, requested, implemented, and tested; deduplicate against existing issues and update them instead of creating overlapping tasks. Track bugs, deferred ideas, acceptance criteria, and evidence of testing.
- Keep durable design rules **and the reasons/tradeoffs behind them** in repository documentation. Reason: decisions should survive chat boundaries without repeatedly revisiting earlier debates.
- After auditing a chat and recording its outstanding items, the user may archive it; archived chats remain historical references. Do not equate archiving with deleting, implementing, or testing a feature.
- No application-code modifications are implied by a chat audit. Only update issues and documentation, then provide a concise summary of actual changes.

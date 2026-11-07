# Broadcast Graphics — Design Handoff (2026-11-07)

Status: **approved design direction; not implemented**.

## Visual identity
- Commercial, multisport, school-neutral Larson Live Stats product. No hawk wings or Jefferson-specific geometry.
- Chosen direction: **C, Layered Championship**: compact, wide, angular, layered scoreboard bug.
- **Game-day jersey color dominates each team's panel**; permanent team identity colors supply accent stripes, borders and subtle gradients.
- Permanent team branding (name, logo, colors) is distinct from game-specific uniform selection.
- Prominent real team logos; readable scores, clock and team names; automatically choose contrasting text for white/light versus dark jerseys.
- Restrained professional broadcast styling: real web-licensed font, crisp SVG geometry, minimal gradient and shadow. No glow, lens flare, metallic chrome, beveled type, heavy texture or gratuitous motion.
- Transparent outside the bug for OBS.
- Test matchup: Jefferson home in white with red/gold accents; Guilford visitor in navy with Columbia blue, white and gold accents. This is only a sample, not product identity.

## Dynamic behavior
- Permanent bug: scores, clock, period, logos, team names, timeout dots, team foul counts, possession, bonus.
- Timeout dots dim or disappear when used; foul counts increment from game state.
- **Attached slide-out announcements**, full width of the relevant team's half, extending downward while the main bug remains fixed. Mirrored home/visitor panels.
- Reusable template supports player personal foul (#11 Robinson, third personal, team's second), basket (#23 Williams, two points, optional assist #5 Johnson), timeout, bonus and potentially substitutions.
- Subtle slide-down/retract animations; draft visible duration ~3 seconds for basket, ~4 for foul or timeout; configurable. Scorekeeper actions must never wait for graphics. Queue overlapping events and eventually provide operator dismiss/suppress/replay.

## Illustrator handoff
- Create one master Illustrator design, not per-team artwork. Export editable SVG with identifiable shapes and retain original AI.
- Suggested 1920x1080 artboard; initial bug ~850–1000px wide by 85–110px tall, slide-out ~45–65px tall; refine visually.
- Keep separate groups for HOME_PANEL, AWAY_PANEL, CENTER, team jersey fill, accent stripes, logo placeholders, team names, scores, clock/period, indicators, HOME_ANNOUNCEMENT and AWAY_ANNOUNCEMENT.
- Do not flatten or rasterize; logos separate; preserve editable text and specify actual font/web license.
- Developer parameterizes SVG/CSS using game data. No Illustrator, InDesign or After Effects required at runtime.

## Existing architecture / implementation caution
- README confirms existing public OBS browser overlay, basketball and soccer scoring, Supabase, and reusable Team Brands.
- Player events/rosters are currently private to owner; public scoreboard has only limited information. A secure, intentional broadcast-event publishing mechanism is needed before showing player foul/assist popouts publicly. Respect RLS and existing privacy rules.
- Verify actual code, tests and OBS behavior before edits. Nothing in this document claims the new graphic is deployed.

## Next steps
1. Finish Illustrator silhouette, typography and separate SVG regions.
2. Inspect existing overlay and brand/uniform data.
3. Implement dynamic bug and contrast rules, then slide-out event queue.
4. Test light/dark jerseys, long names, OBS transparency, mobile and soccer regression.

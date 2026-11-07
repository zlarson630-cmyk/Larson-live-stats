# Larson Live Stats — UI and Product Handoff (November 2026)

## Priority and sequencing
**Do not start more UI implementation until the soccer stats edit is finished.** Prioritize fast, accurate scoring and game-day media reports ahead of broadcast graphics. LIGR is a functional reference, not a design to copy.

## Decisions
- Light-gray/white site background, white panels, dark charcoal text; premium but restrained sports-tech appearance.
- Barlow body and UI text; Barlow Condensed ExtraBold Italic ALL CAPS headings; tabular score numbers.
- Red nonagon Z emblem from user's uploaded logo, followed by LIVE STATS; do not use the personal wordmark. Earlier site screenshot showed a temporary text-based Z, not confirmed exact emblem.
- One login for all sports. Reusable team/school identities, logos and permanent brand colors across sports; sport-specific rosters and schedules. Per-game jersey colors remain separate from permanent branding.
- Future Simple Mode / Full Mode switch: not tied strictly to device; default suggested by screen size, user can override; shared scoring engine and game state. Simple is optimized for fast phone entry while running the clock; Full exposes expanded controls, stats and corrections.
- Core workflow: score once → reliable statistics → polished media-ready PDF (including halftime or in-progress) → optional broadcast graphics later.

## Work status
- Athletic light UI was merged in PR #2. An iPhone screenshot then showed overlapping auth fields, crowded header and controls, squeezed team inputs and jersey colors, and excessive roster setup height.
- A CSS-only repair was committed to `fix/mobile-lobby-layout` at `a28589970fbf9be9ee52c958f46686c63c3797dd`; **deployment/merge was not confirmed in this chat**. Verify before changing anything.
- Exact uploaded emblem integration remains unverified.
- Simple/Full switch is only a design decision, **not implemented**.
- README describes soccer, basketball, cloud Team Brands, OBS, and automated tests; real-device scoring and report verification still required.

## Existing issue tracking
- Soccer event workflow #7; keeper reporting #12; postseason edge cases #13.
- Media PDF quality/completeness #10.
- Basketball picker and broadcast regressions #8.
- Cloud reliability #5; account and shared team brand verification #9.
- Basic/Advanced coverage #4; two-operator workflows #6.
- Broadcast studio and conference ideas intentionally postponed #11.

## Rationale
- A single operator may also run the game clock: touch reliability, speed and low scrolling matter more than visual flourish.
- Media PDFs must work without any broadcast system.
- Shared brands prevent repeatedly setting up the same school; game uniforms can change independently.
- Two layouts must share one event engine to prevent diverging statistics.
- Avoid overlapping code edits while soccer work is underway.

## Next steps, after soccer edits
1. Inspect current main, open PRs and the mobile fix branch; do not assume earlier work was merged.
2. Verify soccer scoring and PDFs end-to-end.
3. Repair mobile layout and replace temporary Z with exact emblem, then test on real phones.
4. Specify and build Simple/Full views separately with regression tests.

Live site: https://zlarson630-cmyk.github.io/Larson-live-stats/

# Larson Live Stats — Product decisions

Official name: **Larson Live Stats**. Basketball first; later volleyball, soccer, football and flag football.

## Required workflows
- Mobile-first browser app; phones must work, Chromebooks desired but not a launch blocker.
- Multiple operators join a master game ID, initially without full login; two operators are the first real collaboration milestone.
- Flexible assignments: points/clock baseline, optional assists, rebounds, turnovers, steals, shooting, and full suite.
- One shared clock, score, period, possession, team fouls, timeouts and bonus.
- Action-first touch scoring: +2/+3 immediately updates team score, then asks scorer (Assign later), then assist (No assist or Assign later). +1 asks scorer. Pending values are flagged for later review.
- Main scoring screen: always-visible current status, actions, last few plays. Separate Game Flow screen: full editable event history, unresolved bubbles, filters, undo.
- Personal foul should update team fouls automatically. Optional player attribution and manual corrections.
- Broadcast dashboard: read-only automatic runs and ranked leaders. Optional minutes only when substitutions are tracked.
- Transparent OBS browser-source graphics: score bug and player spotlight first; manual producer show/hide, live-updating data.
- Future: shot chart, keyboard shortcuts, postgame box score, notes, story, milestones, season stats.

## Current implementation status
Basketball and soccer now use account-owned cloud games, reusable season rosters, and team brands. My Profile shows saved games and provides a way to import older browser records. OBS has public read-only scoreboards. The original same-browser prototype is historical.

The game owner can use the same account on another device. The multiple-operator workflow above remains a product goal and is tracked in [#6](https://github.com/zlarson630-cmyk/Larson-live-stats/issues/6).

## Next acceptance tests
Use [#5](https://github.com/zlarson630-cmyk/Larson-live-stats/issues/5) for live multi-device scoring and recovery. Use [#9](https://github.com/zlarson630-cmyk/Larson-live-stats/issues/9) for the missing-brand retest, legacy import, and sharing between real accounts. The [decision log](product-decisions.md) records the rationale and separates deployed features from verified behavior.

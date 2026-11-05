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
The initial GitHub Pages prototype uses localStorage/BroadcastChannel for same-browser-profile tab synchronization. **It is not cross-device collaborative** and is not production-ready. The OBS overlay preview is also local-only. It needs a Supabase project, persistent event storage, realtime subscriptions, authorization/PIN handling, conflict-safe score and clock actions, and proper reconnect/error states.

## Next acceptance test
Deploy GitHub Pages; test scoring and Game Flow in two tabs of the same browser. Then configure Supabase and verify synchronization between two separate phones before calling the first real multiplayer version complete.

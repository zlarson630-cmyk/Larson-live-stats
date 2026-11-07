# Larson Live Stats — decisions and conversation audit (2026-11-07)

## Product priority and reasoning
1. **Fast, reliable game-day scoring and media-ready reports first.** Accuracy, easy correction, low tap count, and dependable saves outweigh broadcast animation and visual flourish. User often scores on one device while operating the clock; minimize navigation and scrolling. Do not treat committed code as tested.
2. **Neutral, reusable multi-sport branding.** Avoid Jefferson/J-Hawks identity in product branding because it may serve other schools or be sold. Light gray/white surfaces, charcoal typography, red standalone rounded nonagon Z emblem (not the full wordmark), Barlow for UI and Barlow Condensed ExtraBold Italic uppercase athletic headers; tabular score numerals. User approved direction, not a blanket confirmation of implementation.
3. **Game jersey color is primary in live team graphics, brand colors accents.** Permanent team brand identity is stored separately from per-game uniform choice. White home jerseys should yield predominantly white panels, not permanently red.
4. **Live side orientation can be swapped without swapping team identities.** At halftime teams change attacking directions; screen-side switch is presentation only. Permanent media reports always show VISITOR LEFT, HOME RIGHT. No score, event or roster may change as a result.
5. **Soccer event-first workflow with both teams visible.** Press event under the correct team, choose roster player, then record. Separate minutes/seconds numeric fields for iPhone keyboard. Staged substitutions are not recorded until confirmed on-field; basketball follows same principle. Injury stoppage is its own event, not a charged basketball team timeout. Clock must not change merely because an event was recorded.
6. **Soccer crosses optional.** Standard high-school box scores do not generally require them; an ambiguous wide ball is a cross vs shot based on apparent intent, not goalkeeper catching it. Optional categories omitted from reports rather than shown as false zeroes.
7. **Soccer shots and saves linked but not synonymous.** A goal-bound shot stopped by goalkeeper may credit GK save; defender intervention may credit team save; goal is not a save. Editing/removing an event must keep linked records consistent. Own goals should count for benefiting team without ordinary scorer credit. Shootout goals never inflate regulation scoring.
8. **Cloud authority and corrections.** Owner-only writes, explicit save success, conflict recovery and cross-device verification matter more than optimistic UI. Local match archive does not imply cross-device synchronization.
9. **Broadcast graphics deferred.** Existing broadcaster/OBS views are not a finished production studio. Animated foul/scoring slideouts, Illustrator-based configurable bug, timeout dots, motion and multi-game conference feed are future work after scoring and reports are reliable.

## Status discipline
- **Discussed/requested:** goalkeeper MIN/GA/SHO and full postseason overtime handling, not complete.
- **Implemented in repository, not proven in live browser:** soccer PKs, own goals, shootout entry, blocked/total shots, optional stat categories, keeper-change history, match library, staged subs, injury timeouts and screen-side switching; basketball staged substitutions, injury timeouts and side switching. Review issues #7, #8, #12, #13.
- **User-tested:** earlier soccer PDF exported successfully, but user said it was ugly. Subsequent PDF changes not independently verified.
- **Known unresolved reports:** intermittent basketball player selection and earlier soccer bottom-half controls, pending reproduction; branded PDF completeness; real authenticated multi-device cloud scoring. Review #5, #7, #8, #10.
- **Deliberately postponed:** multi-operator basketball scoring (#6), broadcast studio and conference-wide feed (#11), advanced possession/passing analysis; advanced shot blocks are optional rather than required.

## Tracking issues
#4 Basic/Advanced completeness; #5 cloud reliability; #6 two-operator design; #7 soccer regression; #8 basketball regression; #9 account/brand-library verification; #10 reports; #11 broadcast future; #12 goalkeeper stats; #13 postseason edge cases.

Do not alter application code as part of this audit.
## Conversation management and archival workflow (2026-11-07)
- Keep approximately **two or three active project conversations** to reduce cognitive overhead: one durable Product HQ, one temporary active development chat, and an optional ideas/design chat. The third chat is optional, not a required silo.
- Before archiving any temporary chat, invoke the canonical prompt in [CHAT_HANDOFF_PROTOCOL.md](CHAT_HANDOFF_PROTOCOL.md). Inspect existing GitHub Issues and repository documentation, reconcile status, and record reasoning as well as outcomes. Archive only after checking for chat-only context.
- **Why:** archiving preserves the conversation but does not guarantee that all details will be surfaced in a future chat. GitHub code, issues, and product decisions are more durable than relying on conversational recall. Archiving is preferred over deleting because original history remains available if needed.
- The handoff protocol is version-controlled and should be fetched afresh from GitHub on invocation, rather than copied into every chat. Future improvements belong in the single canonical file.
- This workflow is **documented and successfully invoked in this chat**; it does not establish that all future chats will automatically retrieve archived details. Re-run the protocol before each archive.

# Chat Handoff Hub — Larson Live Stats

Updated: 2026-11-07

## Source of truth
Repository: https://github.com/zlarson630-cmyk/Larson-live-stats
Live app: https://zlarson630-cmyk.github.io/Larson-live-stats/
Read README.md and current code before changing implementation.

## Chat responsibilities
- **Original development chat:** build, debug, test, deploy and validate features.
- **Brand/design chat:** visual decisions, Illustrator master, reusable component specifications.
- **GitHub:** durable decisions and implementation status. Chat messages are not canonical.

## Current major upcoming feature
**Broadcast graphics package:** see [BROADCAST-GRAPHICS-DESIGN.md](BROADCAST-GRAPHICS-DESIGN.md).

Approved: compact Layered Championship scoreboard; game-day jersey colors dominate; restrained gradients, real fonts, actual logos; full-width per-team slide-out foul/scoring announcements; live timeout/foul indicators. User may supply Illustrator SVG master. **Not yet implemented.**

Critical dependency: public OBS scoreboards presently do not expose private player events; define secure broadcast publication of selected player announcements before implementation.

## Handoff protocol
1. Read README, this hub, relevant design document, and actual source.
2. Distinguish **shipped**, **in progress**, **approved**, and **idea**.
3. For a new feature, capture decisions in a durable GitHub document before leaving design chat.
4. Development chat implements and tests, recording changed files, tests, commit, and deployment verification.
5. Update this hub when milestones or priorities change; keep a concise next-action list.
6. Never claim live deployment without checking it.

## Next action
Wait for first Illustrator SVG or create a code-based geometry prototype; then inspect current overlay and Team Brands data, plan data access for player announcements, implement and test in phases.

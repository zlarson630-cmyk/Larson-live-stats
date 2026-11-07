# Multisport Expansion — High School First (2026-11-07)

Status: **isolated prototype**, not production-approved. Branch: `feature/multisport-volleyball-v01`.

## Non-negotiables
- Preserve existing basketball and soccer routes, scoring, cloud data, OBS behavior, brands, and permissions. No changes to production pages or database migrations in this pass.
- Start with high-school / NFHS-style configurable defaults; confirm rule specifics against the applicable current rules before game use.
- Option B: scoreboard plus essential player statistics. Never display untracked stats as zero.
- Store ordered, uniquely identified events; derive score and stats deterministically. Undo/corrections must recalculate and preserve history.
- Keep sport-specific scoring interfaces; share team branding, uniform palettes, rosters, identity, authentication, cloud interfaces, and output conventions when safely integrated.
- Jersey worn in a game determines dominant UI color; permanent brand palette supplies accents.
- Scorer writes private; public scoreboard read-only. No service-role secrets in client.

## Sport adapters
Contract proposal: `sportId`, `rulesPreset`, `initialState`, `validateEvent`, `applyEvent`, `deriveStats`, `publicProjection`, `validateState`. Sport engines are pure and deterministic. Integration into Supabase is deferred until backward-compatible schema and security review.

## Volleyball V0.1
Default proposed preset: best of 5 sets, sets 1–4 to 25, deciding set to 15, win by 2, rally scoring; configurable. A set starts with a selected serving team. Each rally awards exactly one point, records winner, optional attribution and rally reason, and transfers serve when necessary. Set/match wins derive from rally history. Support correction/removal, timeouts, lineup/rotation as later milestones (do not falsely represent rotation as enforced). Essential stats: kills, assists, service aces, digs, blocks, and errors; these are recorded explicitly and not inferred from every rally. The scorer must be able to record a rally without attributing a player.

## Baseball / Softball V0.1
Shared configurable diamond engine; innings, half-innings, runs, hits, errors, outs, bases, balls and strikes. Essential stats: hits, runs, RBI, walks, strikeouts, basic pitching. Explicit state transitions; avoid claiming full official scorekeeping until runner advancement, earned runs and substitutions are implemented and verified. Defaults configurable for high-school innings and local variations.

## Football / Flag V0.1
Shared configurable gridiron core, separate rules profiles and sport-specific event options. Score, periods, clock, possession, downs, distance, field position, timeouts. Essential passing, rushing, receiving, TD and defensive stats; flag pulls only for flag. Do not assume tackle football and flag football share identical clock, field, scoring, or down rules.

## Staged delivery
1. Pure volleyball engine, tests and standalone local preview on isolated branch.
2. Automated scenario testing: rally/set transitions, deuce, fifth set, service transfer, attribution, edit/delete, invalid events, replay consistency.
3. Preview scoring UI with dual-team action buttons and clear unsaved/error states.
4. Review rules and statistics semantics; add cloud adapters behind feature flags after RLS review.
5. Baseball/softball then football/flag engines, each with tests and preview.
6. Manual iPhone, signed-in cloud, multi-browser conflict, spectator and OBS verification before any live deployment.

## Acceptance gates
- Existing production files unchanged in branch until integration review.
- Node automated tests pass; compare branch to main and report exact files.
- No user-facing claims of NFHS certification, fully official stats or live readiness.
- On integration, preserve all existing game IDs and state shapes; public views expose only approved metadata.
- Test signed-out read-only, other-account denial, own-account scoring, save failure, reconnect, corrections, multi-browser concurrency, OBS reload, iPhone taps and accessibility.

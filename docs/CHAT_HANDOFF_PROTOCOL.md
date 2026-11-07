# Larson Live Stats — Chat Handoff Protocol

**Purpose:** Preserve important context before archiving a development or planning conversation. GitHub is the durable source of truth; chat history and memory are supplementary, not exhaustive.

**Version:** 1.0 — 2026-11-07

## Quick invocation

> Run the Larson Live Stats handoff protocol for this conversation. Read `docs/CHAT_HANDOFF_PROTOCOL.md` from the current GitHub repository and follow it. Do not modify application code. Tell me when this conversation is safe to archive.

## Instructions for ChatGPT

1. **Review the entire current conversation** and available relevant project context. Identify:
   - Unfinished features, requests, and acceptance criteria.
   - Bugs and regressions reported, whether reproduced or not.
   - Design decisions, constraints, priorities, rejected alternatives, and *why* each was chosen.
   - Future ideas deliberately postponed.
   - Work confirmed completed and the evidence for completion.
   - Anything important that still exists **only in this conversation**.
2. **Inspect the current GitHub repository** and existing issues and documentation before recording work. Do not assume earlier assistant statements about commits or tests are accurate; check current source and tests when possible. Avoid duplicates and stale tasks.
3. **Use explicit status distinctions** for every significant item:
   - **Discussed:** idea considered, not necessarily requested.
   - **Requested:** user authorized or asked for work.
   - **Implemented:** corresponding code/documentation exists in the repository.
   - **Tested:** a specific test was run; describe whether automated, simulated, manual, or live-browser.
   - **Verified working:** successful relevant end-to-end behavior observed, with scope and date if known.
   - **Blocked / deferred:** work outstanding or deliberately postponed.
   Never equate a commit, syntax check, assistant claim, or successful deployment with verified user-facing functionality.
4. **Create or update GitHub Issues** for outstanding work, labeled by sport or feature (such as `soccer`, `basketball`, `reporting`, `bug`, `platform`, or `broadcast`) where those labels exist. Preserve reproducible steps, expected/actual behavior, priority, acceptance criteria, and links to related issues. Update existing issues rather than duplicating them. Do not close an issue merely because code was committed.
5. **Preserve durable design decisions and reasoning** in `docs/PRODUCT_DECISIONS.md` (or the established successor document). Record tradeoffs and rationale, not just conclusions. Maintain project-wide priorities and constraints. Avoid copying long conversational transcripts.
6. **Check for handoff gaps:** identify unresolved information that cannot be confidently reconstructed from GitHub, including screenshots, test observations, user preferences, or outstanding questions. Record the gap in the appropriate issue/document where practical. If an essential detail cannot be saved, explicitly tell the user before recommending archiving.
7. **Do not modify application code** during a handoff. Repository documentation and GitHub Issues may be edited. Do not introduce unrelated features, refactors, or deployments.
8. **Give a short final report** covering:
   - Existing issues updated and new issues created (with links).
   - Documentation changed.
   - What was implemented versus actually tested or verified.
   - Any context that remains at risk.
   - Whether the chat is **ready to archive**, and why.

## Guiding product priorities

- Fast, accurate game-day stat entry and reliable media-ready reports come before broadcast polish.
- Keep the interface usable on a phone under real game conditions.
- Preserve home/visitor identities independently of switchable on-screen sides; permanent reporting places visitor left and home right.
- Preserve the neutral multi-sport brand and game-specific jersey-color conventions.
- Treat existing features as potentially unverified until tested; preserve regression coverage.

## Maintenance

This document is the **single canonical handoff prompt**. Revise it when the workflow changes; use Git history to track revisions. Future chats should fetch the current file rather than rely on a remembered or copied version. Archiving keeps the original chat accessible, but does not guarantee all its details will be retrieved automatically in future conversations.

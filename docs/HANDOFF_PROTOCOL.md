# Larson Live Stats — Development Chat Handoff Protocol

Status: Active process. GitHub is the canonical project record; ChatGPT conversations are temporary working sessions.

## Purpose
Keep only 2–3 active chats. At the end of a development session, preserve decisions, reproducible bugs, tests, unfinished work and useful context in GitHub, then retire the chat. Never treat a historical chat as more authoritative than the current repository.

## Source-of-truth order
1. Current code, SQL migrations, tests, and README on the default GitHub branch.
2. Current GitHub issues / development backlog and recent commits.
3. Most recent verified testing and explicit user decisions.
4. Older chat history (historical evidence only; verify before promoting).

## Trigger
When the user says "run the handoff protocol", "archive this chat", "close out this chat", or similar:
1. Read the current README, relevant code/docs, recent commits, and existing handoff notes.
2. Review the conversation for **new** decisions, features, bugs, unresolved tests, dependencies, and setup facts.
3. Classify each finding: **Already implemented**, **Still open / needs verification**, **Superseded**, or **Historical context**. Do not re-add implemented work as a new task.
4. Create or update a dated file under `docs/handoffs/` with concise findings and links/paths to canonical code. Include evidence, current status, and next action where appropriate. Do not include passwords, private tokens, or personal information.
5. If an actionable item is still open, add it to the existing canonical backlog/issue tracker (if one exists), or mark it explicitly as a candidate for triage in the handoff. Avoid duplicate issues.
6. Check the committed files and report the GitHub link and commit. State what was **not** verified.
7. Tell the user this chat is safe to retire; never claim to delete or close the conversation automatically.

## Required handoff sections
- Date, chat scope, and repository state reviewed
- **Decisions worth retaining**
- **Already implemented / superseded**
- **Open bugs and test candidates** (repro steps, expected/actual if known)
- **Next actions**, in priority order
- **Verification performed** and limitations

## New-chat startup
Ask the next chat to read this protocol, the README, the latest dated handoff, recent commits, and the relevant implementation/tests before making changes. Work from current GitHub state. Confirm requirements only where ambiguity affects behavior. Keep temporary brainstorming in the chat; commit durable decisions and tests.

## Suggested user commands
- "Run the Larson Live Stats handoff protocol on this chat."
- "Start a new Larson Live Stats development chat using the latest GitHub handoff."
- "Compare this old chat against GitHub and archive only what's still useful."

## Maintenance
Do not rewrite historical handoffs to match new code; append a new dated handoff when status changes. Keep files concise. The handoff is not proof that a feature works: code inspection, automated tests, and live testing are separate evidence.

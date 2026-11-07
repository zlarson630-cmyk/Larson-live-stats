# Cloud profile and brand sharing

Open My Profile from Basketball, Soccer, or Team Brands. Sign in with the same scorer account on each device to use the same cloud brands, reusable season rosters, and game history. The app no longer offers device-only scoring or brand saves. Game snapshots preserve the rosters and brands used in that game. Live public scoreboards retain the existing game-code behavior; private game state and season roster libraries are owner-only.

To bring in older records, open My Profile in the browser where they were saved and choose **Import older records to my account**. The importer preserves existing cloud brands and rosters, recognizes earlier cloud soccer snapshots, and uses a per-account import key to avoid duplicate games. Older browser originals are kept as a backup. Importing a game creates a cloud game code and public scoreboard summary, as with existing cloud games. Player rosters and play details stay private.

Team Brands puts the full cloud library above the editor. **Share brand** publishes a snapshot of just the name, logo and uniform colors. Other signed-in users can browse shared brands or use a share link and choose **Add to my library**. Copies are independent. **Stop sharing** removes the original from discovery without affecting existing copies.

The cloud library migration creates owner-only `account_roster_libraries`, a scoped `legacy_ref` unique index on `live_games`, and the opt-in `shared_team_brands` catalog. Authenticated users may read published snapshots; only the owner can publish or change a share. Both new tables use RLS and have no anonymous access. No service credential is used by the browser.

Run `node --test tests/*.test.cjs` to exercise the app scripts with simulated cloud clients. Production RLS was checked with two authenticated test identities in a rolled-back transaction, including roster isolation, published-only discovery, cross-owner writes and anonymous grants.

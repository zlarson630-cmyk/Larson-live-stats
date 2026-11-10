# Larson Live Stats test and release workflow

Production is [Larson Live Stats on GitHub Pages](https://zlarson630-cmyk.github.io/Larson-live-stats/). GitHub publishes from `main`. Production uses the existing Larson Live Stats Supabase project (`mdbxghrqpvqqruzrlqsi`).

The separate test environment uses the Larson Live Stats Test Supabase project (`xciilhnbqlzlbszqctow`) and [private test hosting](https://larson-live-stats-test.zachlarson.chatgpt.site). Use fictional teams, players, and games. Create tester accounts in the test project with unique passwords. Keep public signups disabled and give access only to approved testers. Treat tester emails as account data and keep them out of Git. Avoid imports or exports involving live accounts, real rosters, or real games.

## Prepare a test build

1. Check out the exact candidate commit in a dedicated checkout. Run `node tests/check-page-assets.cjs` and `node --test tests/*.test.cjs`.
2. Use the test environment build script from the infrastructure branch. Set `TEST_SUPABASE_URL` and `TEST_SUPABASE_PUBLISHABLE_KEY` to the test project's API URL and public publishable key. Run `node scripts/build-test-site.cjs NEW_DIRECTORY`. The build uses only site assets, rejects the production project reference, and marks every page TEST. For a local UI-only preview, omit both settings and add `--offline`.
3. Publish the generated files to the separate test host and record the candidate commit and test URL. Verify the deployed `live.js` uses the test project. Restrict the host to invited testers. The host's sign-in controls access to the site, while the test Supabase sign-in controls scorer permissions.
4. Use two test accounts and a signed-out viewer. Create a game, score, run and stop the clock, undo a play, reload and resume, and verify the viewer and overlay update. Confirm that the second account cannot modify the first account's game or read its private roster or schedule. Check a basic create/view flow in each other sport before releasing any shared changes.

The test project was bootstrapped with `001_live_games.sql`, `002_soccer_clock.sql`, `003_soccer_logos.sql`, `004_team_brand_display.sql`, `005_account_team_brands.sql`, `20261107033008_cloud_library_and_shared_brands.sql`, `005_private_scheduled_games.sql`, and `008_game_center.sql`, in that order. Test setup also granted authenticated select/insert/update on `live_games` and public read access on `live_scoreboards`, and revoked direct client execution of the scoreboard trigger function. The community-scoring proposal is outside the baseline.

## Work in parallel and promote a release

- Keep each sport in its own branch and checkout, such as `feature/basketball-workflow`. Coordinate ownership before editing shared auth, database schema, navigation, or publishing files. Use one integration candidate and one person to publish it to the test host at a time.
- Open a PR to `main` with the tested commit, test results, and any migration or rollback steps. Rebuild and retest when shared code changes or the candidate is updated. Review backwards compatibility with existing games before changing production data structures.
- With explicit release approval, the release owner applies reviewed, backward-compatible production migrations if needed, merges the approved PR, checks the GitHub Pages deployment, and verifies the live landing page, game viewer, and overlay. Keep the previous production commit handy for a revert. Promote source changes and migrations only. Keep test credentials, games, and generated artifacts in the test environment.
- Target November 23, 2026 for the basketball workflow decision. Rehearse a full practice game before releasing. After release, hold core scoring controls, clock, undo, and game-resume behavior steady through February 2027. Handle critical fixes through the same test and approval process. Keep experiments on feature branches and the test host.

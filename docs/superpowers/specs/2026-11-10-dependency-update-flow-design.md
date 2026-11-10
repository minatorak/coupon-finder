# Dependency update flow design — 2026-11-10

Status: approved (short design, small change)

## Intent and why

Dependency updates need local verification before pushing and a CI check at
merge time. Today nothing checks a normal PR merge: `.github/workflows/build.yml`
only triggers on `v*` tags. Updating is also overdue: `playwright 1.45.3` has a
known high vulnerability (GHSA-7mvr-c777-76hp, browser download without SSL
certificate verification, fixed in 1.55.1) and the latest is 1.65.0.

Deliverable is two shell scripts under `scripts/` plus one new workflow — not
CLI commands of coupon-finder.

## Goals

- `scripts/verify.sh`: one verification script, two modes.
  - basic (default): `bun install --frozen-lockfile` → `bunx tsc --noEmit` →
    `bun test --pass-with-no-tests` → `bun audit` (fail on any vulnerability).
  - full (`--full`): basic + browser smoke test (scrape `couponami --pages 1`
    headless) + `bun run build:release` for the current platform + smoke
    `--version` on the built binary.
- `scripts/update-dependencies.sh` (local, interactive): show `bun outdated`;
  ask confirmation per heavy-impact item before applying (playwright → latest,
  bun runtime + `BUN_VERSION` in `build.yml`); apply updates; run
  `bunx playwright install firefox chromium` for the new browser revisions;
  then call `verify.sh --full`; print a summary.
- `.github/workflows/ci.yml` (new): `pull_request` targeting `main` and
  `push` to `main`/`dev` → run `bash scripts/verify.sh` in basic mode.
- `.github/workflows/build.yml` (edit): only the `BUN_VERSION` value, updated
  by the script with confirmation.

## Non-goals / anti-goals

- No new coupon-finder CLI command for this flow.
- No dependabot/renovate automation, no auto-merge, no scheduled updates.
- No scraper logic changes.
- CI stays basic-only: no smoke test, no release build, no audit bypass.

## Constraints

- playwright 1.45.3 → 1.65.0 changes browser revisions; managed browsers must
  be installed before the smoke test can run.
- Heavy-impact steps must ask before acting (per conversation decision).
- Scripts are bash, `set -euo pipefail`, fail loudly, no silent steps.

## Approaches considered

- Scope: playwright-only vs playwright+bun vs generic updater vs patch-only.
  Picked playwright + @types/bun + bun runtime — covers the vulnerability and
  the local/CI bun mismatch; generic updater rejected as over-engineered for
  two dependencies.
- Structure: single script vs verify.sh + update-deps.sh vs Makefile wrappers
  vs three files. Picked verify.sh + update-deps.sh — single source of truth
  shared literally by local runs and CI; Makefile rejected as extra indirection.
- Local verify depth: static-only vs +browser smoke vs +release build vs full
  find. Picked basic + smoke + release build (`--full`); full `find` rejected
  (network flakiness, false failures unrelated to dependencies). Static-only
  rejected: tsc+test passed while scraping was actually broken (udemyxpert
  badge selector incident, 2026-11-10).
- CI shape: new ci.yml calling verify.sh vs inline commands vs extending
  build.yml vs reusable workflow. Picked new ci.yml calling verify.sh — does
  not touch the release pipeline; duplication rejected as drift risk.
- playwright strategy: straight to latest (with confirm) vs stepwise vs pinned
  arg vs blanket `bun update --latest`. Picked straight to latest + per-item
  confirm; stepwise rejected as many full verify rounds for a small scraper.
- Browser install after update: script installs vs instruct-only vs release
  browsers path vs catch-and-retry. Picked script runs
  `bunx playwright install firefox chromium`; instruct-only leaves smoke
  failing after every update.

## Calls made by the assistant (correctable)

- Smoke source is `couponami --pages 1` (most stable source; mirrors
  `make find-fast`).
- Audit fails on any severity, not only high.
- CI runs on ubuntu-latest with the pinned `BUN_VERSION`, basic mode only.
- Smoke test runs the scraper through the playwright-managed browser via
  `PLAYWRIGHT_BROWSERS_PATH` so it does not depend on a system browser.

## Left to the builder

- Exact prompt wording, output formatting, and summary layout of both scripts.
- Whether `build:release` output goes to `dist/release` (as CI) or a temp dir.
- Robustness details: TTY detection for prompts, `--yes` skip flag if needed.
- Version strings for BUN_VERSION replacement (match local `bun --version`).

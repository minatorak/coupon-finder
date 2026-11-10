# Dependency Update Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `scripts/verify.sh` (basic/full), `scripts/update-dependencies.sh` (interactive, confirm-per-heavy-item), a tag-independent CI workflow, and perform the real update (playwright 1.45.3 → 1.65.0, bun runtime sync) — all verified locally before merge.

**Architecture:** One verification script is the single source of truth: local full checks and CI basic checks both execute the same file. The update script orchestrates confirmations, applies updates, installs the new playwright browsers, then delegates to `verify.sh --full`.

**Tech Stack:** bash (set -euo pipefail), bun 1.4.x CLI (`outdated`, `audit`, `update`, `test`), playwright CLI (`install`), GitHub Actions (setup-bun@v2).

**Spec:** `docs/superpowers/specs/2026-11-10-dependency-update-flow-design.md`

## Global Constraints

- Scripts are bash with `set -euo pipefail`, executable bit set.
- No coupon-finder CLI changes; nothing added to `src/`.
- `verify.sh` basic = `bun install --frozen-lockfile` → `bunx tsc --noEmit` → `bun test --pass-with-no-tests` → `bun audit` gate (fail on any vulnerability). `--full` = basic + browser smoke + release build + binary `--version`.
- Heavy-impact update steps (playwright, bun runtime) prompt before acting; `--yes` flag skips prompts; non-TTY without `--yes` aborts with a clear message.
- Scripts work from any working directory (resolve repo root via `git rev-parse --show-toplevel`).
- `BUN_VERSION` in `.github/workflows/build.yml` AND `.github/workflows/ci.yml` is synced by the update script (both files carry `BUN_VERSION: "<major.minor.patch>"`).
- Commit messages follow caveman-commit (conventional, imperative, ≤50 chars subject, why-body where non-obvious).

## Review Focus

- Run from another directory (`bash /abs/path/verify.sh` from `/tmp`) → must still operate on the repo, not fail on relative paths. Pinned in Task 1 step 4.
- `bun audit` exits non-zero with vulnerabilities present → basic mode must exit non-zero overall (proven today: 1 high vuln on current lockfile). Pinned in Task 1 step 4.
- `--full` when no playwright browsers installed → fails with a one-line pointer to `bunx playwright install firefox chromium`, not a raw ENOENT dump. Pinned in Task 2 step 4.
- Non-TTY stdin for `update-dependencies.sh` prompts → aborts gracefully, never hangs. Pinned in Task 2 step 4.
- Dirty working tree when running `update-dependencies.sh` → warns and requires explicit confirmation before touching anything. Pinned in Task 2 step 4.

---

### Task 1: `scripts/verify.sh` — basic + full modes

**Files:**
- Create: `scripts/verify.sh` (chmod +x)

**Interfaces:**
- Produces: `verify.sh` (no args = basic) and `verify.sh --full` (basic + smoke + build). Exit 0 = pass, non-zero = fail at first failing section. Prints a `== section ==` banner per section. Consumed by Task 3's ci.yml and Task 4's update script.

- [ ] **Step 1: Write `scripts/verify.sh`**

Structure (implementer writes bodies; these are the exact sections and order):
1. Header: `set -euo pipefail`, `cd "$(git rev-parse --show-toplevel)"`.
2. Parse optional `--full` flag (reject unknown args with usage line, exit 2).
3. `== install ==`: `bun install --frozen-lockfile`.
4. `== type-check ==`: `bunx tsc --noEmit`.
5. `== tests ==`: `bun test --pass-with-no-tests`.
6. `== audit ==`: gate on `bun audit` — first check `bun audit >/dev/null 2>&1; echo $?` semantics and implement so any vulnerability exits non-zero with the audit output shown.
7. Full-only sections, guarded by the flag:
   - `== browser smoke ==`: resolve newest managed firefox executable by globbing the playwright cache (`${PLAYWRIGHT_BROWSERS_PATH:-<platform default>}`; macOS default `~/Library/Caches/ms-playwright`, Linux `~/.cache/ms-playwright`) against `firefox-*/firefox/Nightly.app/Contents/MacOS/firefox` (macOS) or `firefox-*/firefox/firefox` (Linux), pick highest revision (`sort -V | tail -1`); export `COUPON_FINDER_BROWSER_PATH=<resolved>`; run `bun run src/cli.ts find --source couponami --pages 1`. If no executable found: print the install pointer (`bunx playwright install firefox chromium`) and exit 1.
   - `== build release ==`: compute target like the Makefile does (`uname -s` lowercase + `uname -m` mapped x86_64→x64, aarch64→arm64); run `bun run build:release -- --target "$target" --output-dir dist/release`; run `./dist/release/coupon-finder-"$target" --version`.
8. Final `== verify OK (basic|full) ==` line.

- [ ] **Step 2: Syntax + executable check**

Run: `bash -n scripts/verify.sh && test -x scripts/verify.sh && echo ok`
Expected: `ok`

- [ ] **Step 3: Basic-mode gate proof (audit currently fails)**

Run: `bash scripts/verify.sh; echo "exit=$?"`
Expected: fails at `== audit ==` with the GHSA-7mvr-c777-76hp high finding visible, `exit=` non-zero. This proves the vulnerability gate works before the update exists.

- [ ] **Step 4: Run from another directory**

Run: `cd /tmp && bash <repo>/scripts/verify.sh >/dev/null 2>&1; echo "exit=$?"`
Expected: same non-zero result (fails at audit, not on paths).

- [ ] **Step 5: Commit**

```bash
git add scripts/verify.sh
git commit -m "build: add verify script for local and CI checks"
```

### Task 2: `scripts/update-dependencies.sh` — interactive update flow

**Files:**
- Create: `scripts/update-dependencies.sh` (chmod +x)

**Interfaces:**
- Consumes: `verify.sh --full` (Task 1) via `bash "$ROOT/scripts/verify.sh" --full`.
- Produces: end-state where `package.json`, `bun.lock`, `.github/workflows/build.yml`, `.github/workflows/ci.yml` reflect updated versions (applied in Task 4).

- [ ] **Step 1: Write `scripts/update-dependencies.sh`**

Structure:
1. Header: `set -euo pipefail`, cd to repo root, accept optional `--yes`.
2. `preflight`: show `bun --version`, current dep versions (`bun pm ls`), and `git status --short`; if tree dirty → warn and require explicit confirm (prompt works even with `--yes`? No — dirty-tree confirm is interactive-only: abort in non-TTY, prompt in TTY regardless of `--yes`).
3. `outdated`: run `bun outdated`; if exit says nothing outdated → print "already up to date" and exit 0.
4. `confirm heavy items` (skipped values of `--yes`): 
   - playwright: current → latest, impact note "browser revisions change + scraper API".
   - bun runtime: compare local `bun --version` vs `BUN_VERSION` in the two workflow files, impact note "release pipeline pin".
5. `apply`:
   - `bun update --latest playwright`
   - `bun update --latest @types/bun`
   - `bunx playwright install firefox chromium`
   - if bun runtime confirmed: `bun upgrade`, then rewrite `BUN_VERSION: "…"` lines in both workflow files with the new `bun --version` (`sed -i.bak` + cleanup, portable darwin/linux).
6. `verify`: run `bash scripts/verify.sh --full`.
7. `summary`: before/after versions + list of changed files (`package.json bun.lock .github/workflows/*.yml`) + reminder that commit/push is manual.

- [ ] **Step 2: Syntax + executable check**

Run: `bash -n scripts/update-dependencies.sh && test -x scripts/update-dependencies.sh && echo ok`
Expected: `ok`

- [ ] **Step 3: Non-TTY safety proof**

Run: `bash scripts/update-dependencies.sh < /dev/null; echo "exit=$?"`
Expected: aborts before any mutation (dirty-tree/outdated path safe — nothing staged/modified; `git status --short` still empty), prints why, `exit=` non-zero.

- [ ] **Step 4: No-browser pointer proof**

Run: `PLAYWRIGHT_BROWSERS_PATH=/tmp/empty-cache bash scripts/verify.sh --full >/dev/null 2>&1` — confirm output contains the `bunx playwright install firefox chromium` pointer line (via running without redirect once), non-zero exit. Restore expectations: no cache mutation.

- [ ] **Step 5: Commit**

```bash
git add scripts/update-dependencies.sh
git commit -m "build: add dependency update script"
```

### Task 3: `.github/workflows/ci.yml` — merge-time check

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `scripts/verify.sh` basic mode (Task 1). Mirrors `env.BUN_VERSION` pattern from `build.yml` (Task 4 keeps both in sync).

- [ ] **Step 1: Write `ci.yml`**

Decisions fixed by plan: `name: CI`; triggers `pull_request` → `branches: [main]` and `push` → `branches: [main, dev]`; `permissions: contents: read`; single job `verify` on `ubuntu-latest`; steps: `actions/checkout@v7`, `oven-sh/setup-bun@v2` with `bun-version: ${{ env.BUN_VERSION }}` and file-level `env: BUN_VERSION: "<current build.yml value>"`, then `bash scripts/verify.sh`.

- [ ] **Step 2: YAML sanity**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run verify script on push and PR"
```

### Task 4: Execute the real update on this branch

**Files:**
- Modify: `package.json` (playwright, @types/bun), `bun.lock`, `.github/workflows/build.yml` + `.github/workflows/ci.yml` (BUN_VERSION), `docs/superpowers/plans/…` not affected.

**Interfaces:**
- Consumes: both scripts (Tasks 1–2), ci.yml (Task 3).

- [ ] **Step 1: Run the update**

Run: `bash scripts/update-dependencies.sh` (interactive confirms: playwright → yes, bun runtime → yes)
Expected: script completes through `verify.sh --full` with `== verify OK (full) ==`.

- [ ] **Step 2: Confirm end-state values**

Run: `bun pm ls | grep playwright && bun --version && grep -n BUN_VERSION .github/workflows/*.yml`
Expected: playwright ≥ 1.55.1 (target 1.65.0), `bun audit` clean (re-run `bun audit` → 0 vulnerabilities), both workflows show the same `BUN_VERSION` = local bun version.

- [ ] **Step 3: Commit the update (security fix requires body)**

```bash
git add package.json bun.lock .github/workflows/build.yml .github/workflows/ci.yml
git commit -m "build: update playwright to 1.65.0 and bun to 1.4.2" -m "playwright <1.55.1 ships GHSA-7mvr-c777-76hp (high): browser downloads skip SSL certificate verification. BUN_VERSION pins in both workflows now match the local runtime."
```
(subject version numbers adjusted to actuals; bun subject only if runtime actually changed)

- [ ] **Step 4: Final branch verification**

Run: `bash scripts/verify.sh; echo "exit=$?"`
Expected: all basic sections pass, `exit=0` — the same command CI will run at merge.

- [ ] **Step 5: Push branch for CI round**

Run: `git push -u origin chore/dependency-update-flow`
Expected: remote branch created; GitHub runs the new CI workflow on the push; PR to `main` triggers it again (the "check ซ้ำอีกที" at merge).

# Plan: Phase 7 — CLI Version Management (`coupon-finder update`)

_Locked via grill — by Claude + User_  
_Revised per Codex Review (12 concrete findings)_

## Goal

Add an interactive `coupon-finder update` command that allows users to view available versions from GitHub Releases, select one (including downgrading), and update their installed CLI in-place with SHA256 checksum verification. After update, user is informed that a shell restart is needed for the new version to take effect.

## Prerequisites (Phase 6 must deliver)

Phase 7 depends on Phase 6 producing:
1. **Compiled release binaries** for each platform/arch: `coupon-finder-{platform}-{arch}` (e.g., `coupon-finder-darwin-x64`, `coupon-finder-linux-x64`)
2. **SHA256 checksum files** alongside each binary: `coupon-finder-{platform}-{arch}.sha256`
   - Format: Single line with exactly 64 hex characters + optional filename (e.g., `abc123...def456  coupon-finder-darwin-x64`)
   - Must be parseable: extract hash, validate it's 64 hex chars, optionally validate filename matches asset
3. **No draft/prerelease confusion** — CI publishes final releases only (or Phase 7 filters them)

If Phase 6 does not produce these assets, Phase 7 must refuse to run and show: `Error: Phase 6 release assets not found. Ensure binaries and .sha256 files are in GitHub Releases.`

## Approach

### 0. Versioning & Detection (Codex Finding #2)

- **Create `src/version.ts`** — Single source of truth
  ```typescript
  export const VERSION = "0.1.0";
  ```
- **`src/cli.ts`** imports from `src/version.ts` (not `package.json`)
- **`src/commands/update.ts`** reads the same `src/version.ts` to detect current version
- **`package.json` version** must be kept in sync (manual for now; future CI automation)

### 1. Platform Detection & Validation (Codex Finding #9)

- **Create `src/utils/platform.ts`**
  - Detect platform/arch via `os.platform()` + `os.arch()` → normalized string
  - **Supported platform matrix:**
    - `darwin-x64` → macOS Intel (x86_64)
    - `darwin-arm64` → macOS Apple Silicon (aarch64)
    - `linux-x64` → Linux x86_64
  - **Unsupported platforms:** Windows, other OS/arch → fail fast with: `Error: Unsupported platform ${platform}-${arch}. Reinstall from source.`

### 2. Install Layout Detection & Validation (Codex Finding #3)

- **Create `src/utils/install.ts`**
  - `resolveInstalledBinary()` — find current running executable path
    - Use `process.execPath` (not `which coupon-finder` — resolves wrappers/symlinks unpredictably)
    - Validate it's a regular file (not symlink), readable, and in a writable directory
  - `validateInstallLayout()` — check install directory state
    - Confirm directory exists and is writable (via temp file probe; see Finding #4)
    - Refuse wrapper-only or source-install layouts: `Error: Unsupported install layout. Reinstall using: curl ... | bash`
  - Export current binary path for later backup/replace

### 3. Permission Check with Capability Probe (Codex Finding #4)

- **In `src/utils/install.ts`**
  - Create a temp file in the install directory (same FS boundary)
  - Attempt: create, write, rename (same dir), delete
  - If any step fails → warn user and suggest `sudo coupon-finder update`
  - If all steps succeed → proceed with confidence

### 4. GitHub Release Selection & Filtering (Codex Finding #10)

- **Create `src/utils/releases.ts`**
  - **Fetch releases** — paginated API call, max 100 per request
    - Exclude `draft == true` releases
    - Decide: include `prerelease == true`? (v0 choice: exclude; docs: "stable releases only")
    - Sort by semantic version descending (parse `tag_name` as semver)
  - **Filter for required assets** — for selected version:
    - Must have binary: `coupon-finder-{platform}-{arch}`
    - Must have checksum: `coupon-finder-{platform}-{arch}.sha256`
    - If missing either → skip this version, try next
  - **Display menu** — show versions with download counts or date (UX polish)

### 5. Download & Checksum Verification (Codex Findings #7, #8)

- **Create `src/utils/download.ts`**
  - **Fetch timeout strategy** (not `retryWithTimeout` — 5s total is too short):
    - Connection timeout: 10s (DNS + TCP)
    - Per-chunk timeout: 30s (no progress for 30s = network stall)
    - Total request timeout: 5min (for large binaries)
    - Retry: 3x on network errors, with exponential backoff (1s, 2s, 4s)
  - **Download to temp file** (same directory as install target, for atomic rename later)
    - Use random suffix: `/path/to/install/dir/.coupon-finder-update-{random}.tmp`
    - Stream to disk (not buffered in memory)
  - **Verify checksum** — `src/utils/checksum.ts`
    - Fetch `.sha256` file from release
    - Parse strictly: extract exactly 64 hex characters
    - Validate filename match (if present): `filename == binary_asset_name`
    - Compute SHA256 of downloaded binary (stream, not memory)
    - Compare: if mismatch → delete temp file, fail with error, **do not touch current binary**

### 6. Atomic Replacement with Backup (Codex Findings #1, #5, #6)

- **In `src/commands/update.ts`**
  - **Backup** — same directory as current binary
    - Copy current binary to `.coupon-finder-backup-{timestamp}.bak` before replacement
    - Keep only latest 1-2 backups (cleanup older ones)
  - **Atomic replace** — on same filesystem
    1. Verify temp file still exists and is correct size
    2. `chmod +x` the temp file
    3. `fsync()` if available (Node.js fs.fsyncSync on temp)
    4. `fs.renameSync()` from temp to final location (atomic on POSIX)
    5. On success → delete oldest backup (keep latest)
    6. On rename failure → delete temp, restore from backup, throw error
  - **Never leave corrupted/truncated binary** — all operations atomic or fully rolled back

### 7. Concurrency Guard (Codex Finding #11)

- **In `src/commands/update.ts`** — before any download
  - Acquire lock file: `${installDir}/.coupon-finder-update.lock`
  - Lock strategy: `lockfile` package or manual: create + write PID, check stale (10min TTL)
  - If locked: exit with `Error: Update already running. Try again in a moment.`
  - Release lock after success/failure

### 8. Enhanced Observability & Logging (Codex Finding #12)

- **Log lifecycle events** (via `src/utils/logger.ts`):
  - Selected version + asset name
  - Target install path + temp path
  - Download size + speed
  - Checksum result (hash match, no token dumps)
  - Failure category (network, permission, checksum, rename, etc.)
  - Exclude: full GitHub API responses, auth tokens, absolute paths in user home
- **Show user feedback**
  - Progress bar during download (optional, nice-to-have)
  - Success: `✓ Updated: v0.1.0 → v0.2.0`
  - Summary: `Installed to: /usr/local/bin/coupon-finder (X bytes)`
  - Reminder: `⚠️  Restart your shell to use the new version`

### 9. Main Update Command Flow (Codex Finding #1 — put Phase 6 prereq check here)

1. Load current version from `src/version.ts`
2. Detect platform/arch → if unsupported, fail
3. Resolve installed binary path → if unexpected layout, fail
4. Acquire update lock
5. Fetch releases (paginated, sorted, filtered) from GitHub API
6. If no compatible versions available → error
7. Display interactive menu: `[1] v0.2.0  [2] v0.1.0  ...` (user navigates with number + Enter)
8. User selects version
9. If selected == current → silent exit (no rebuild-shell reminder needed)
10. If selected != current → check permissions (temp file probe)
11. If permission denied → warn `sudo coupon-finder update` and exit cleanly
12. Download binary + checksum to temp files
13. Verify checksum (strict parsing, compare hashes)
14. On mismatch/network error → cleanup temp, show error, release lock, exit
15. Backup current binary
16. Atomically replace (rename temp → final, chmod +x, fsync if available)
17. On failure → restore from backup, cleanup, release lock, exit
18. On success → show summary, log completion, release lock
19. Inform user: `⚠️  Restart your shell to use the new version`

## Key Decisions & Tradeoffs

| Decision | Chosen | Rationale | Alternative |
|----------|--------|-----------|-------------|
| **Version source** | `src/version.ts` + GitHub Releases API | Single source of truth for CLI version; Phase 6 releases contain binaries | package.json, git tags |
| **Update type** | Atomic in-place replacement | Standard behavior (`brew upgrade`), minimal state | Side-by-side, package manager |
| **Selection UI** | Interactive menu (numbered) | User-friendly, discoverable | CLI flags only, `--version=X` |
| **Verification** | SHA256 checksums from release assets | Standard practice, manual-verifiable by user | GitHub API metadata, file size, signing |
| **Failure behavior** | Atomic replace + backup restore on rename fail; cleanup temp on other failures | Safest: full success or no change to binary | Manual recovery, partial update, auto-upgrade |
| **Permissions check** | Temp file probe in install dir (same FS) | Proves write+rename capability before download | Check directory perms only, auto-sudo |
| **Already latest** | Silent exit (no-op) | Non-disruptive, fast path | Error message, re-show menu |
| **Downgrade support** | Allowed (full semver sort) | Flexibility for bug workarounds | Latest-only, forced upgrade |
| **Offline support** | Network required (no local cache) | Simpler, updates are rare | Cache version list, side-channel |
| **Concurrency** | Lock file with PID + TTL | Prevents corrupted state from parallel updates | No lock, trust user discipline |
| **Post-update** | Show summary + restart message | User understands new binary not in use yet | Silent, auto-restart shell (risky) |
| **Unsupported platforms** | Fail + suggest reinstall | Clear error message, avoids confusion | Silently skip, ignore update |

## Resolved via Codex Review

These items were identified as critical in the codex review and are now addressed above:

| Item | Codex Finding | Resolution |
|------|---------------|----|
| Current version detection | #2 | Generate `src/version.ts` as single source of truth |
| Install path resolution | #3 | Use `process.execPath`, validate layout, refuse wrappers |
| Permission safety | #4 | Temp file probe (create, write, rename, delete) in install dir |
| Atomic replacement | #5 | Download to temp, verify, chmod, fsync, rename; backup + restore on fail |
| Concurrency safety | #11 | Lock file with PID + 10min TTL before any download |
| Large binary downloads | #7 | Update-specific timeouts (10s conn, 30s per-chunk, 5min total), retry 3x |
| Checksum validation | #8 | Strict parsing: exactly 64 hex chars, optional filename match |
| Platform matrix | #9 | Explicit support: darwin-x64, darwin-arm64, linux-x64 only |
| Release filtering | #10 | Exclude drafts, define prerelease policy, paginate, sort by semver |
| Observability | #12 | Log version, asset name, paths, failure category; no tokens/PII |

## Remaining Open Questions

1. **GitHub API rate limiting** — Unauthenticated API: 60 req/hour
   - v0: No caching, users rarely update; acceptable for now
   - v1 (Phase 8): Cache release list for 1 hour, or accept GitHub token from env

2. **Prerelease handling** — Include beta/RC versions in the menu?
   - v0 decision: Exclude (stable releases only); document in help text
   - v1: Add `--include-prerelease` flag if user demand exists

3. **Backup retention** — How many old binaries to keep?
   - v0 decision: Keep latest 1 backup only; delete on successful next update
   - v1: Config option for backup count

## Out of Scope

- **Automatic updates** — No background daemon checking for new versions
- **Update notifications** — No banner on startup saying "new version available"
- **Changelog display** — No `--changelog` flag to show release notes
- **Multi-version management** — No side-by-side versions, no version switching
- **Offline updates** — No cached version list, no local version store
- **Non-GitHub sources** — Only GitHub Releases, no custom update servers
- **Signed binaries** — No GPG/code signing verification (SHA256 only)
- **Automatic rollback on error** — Backup is manual, not automatic (YAGNI)

---

## Implementation Order (Phase 7)

### Sprint 1: Core Utilities & Versioning

1. **Add `src/version.ts`** (generated version constant)
   - Single version source, imported by CLI + update command
   - Keep `package.json` version in sync manually

2. **Add `src/utils/platform.ts`** (platform detection & validation)
   - `getPlatformArch()` → normalized `darwin-x64` | `darwin-arm64` | `linux-x64` | error
   - `validatePlatform()` → throw on Windows or unsupported platforms

3. **Add `src/utils/install.ts`** (install layout & permission checking)
   - `resolveInstalledBinary()` → uses `process.execPath`, validates file + dir
   - `validateInstallLayout()` → refuses wrapper installs
   - `checkWritePermissions()` → temp file probe (create, write, rename, delete)

4. **Add `src/utils/releases.ts`** (GitHub API client)
   - `fetchReleases()` → paginated API, exclude drafts, sort by semver descending
   - `filterCompatibleAssets()` → find binary + checksum for platform
   - `createReleaseMenu()` → format for interactive selection

5. **Add `src/utils/download.ts`** (download + temp file management)
   - `downloadToTemp()` → with update-specific timeouts (10s conn, 30s chunk, 5min total)
   - `retryDownload()` → 3x with exponential backoff on network errors
   - `cleanupTemp()` → safe deletion of temp files

6. **Add `src/utils/checksum.ts`** (SHA256 verification)
   - `parseChecksum()` → strict validation (exactly 64 hex chars, optional filename)
   - `computeSHA256()` → stream-based (not memory)
   - `verifyChecksum()` → compare parsed hash with computed hash

### Sprint 2: Update Command & Lock Management

7. **Add `src/utils/lock.ts`** (concurrency guard)
   - `acquireLock()` → create lock file with PID + timestamp, check stale (10min TTL)
   - `releaseLock()` → delete lock file
   - Used as guard in update command (fail if already locked)

8. **Add `src/commands/update.ts`** (main update flow)
   - Implement 19-step flow from Approach section #9
   - Acquire lock → fetch releases → show menu → select → validate → download → verify → backup → atomic replace → release lock
   - Comprehensive error handling + logging at each step
   - On success: show summary + restart reminder

### Sprint 3: Integration & Testing

9. **Update `src/cli.ts`** (route update command)
   - Import + register `update` command in command routing
   - Ensure `--version` uses `src/version.ts`

10. **Update `src/version.ts` sync with `package.json`** (manual for now)
    - Note in README for maintainer: keep versions in sync

11. **Add Makefile targets**
    - `make update` — runs `bun run src/cli.ts update` for manual testing
    - `make update-test-version-x` — test downgrade scenario

12. **Update documentation**
    - `README.md`: Add "Update" section with command + workflow
    - `docs/api-reference.md`: Document `coupon-finder update` + errors
    - Mention shell restart requirement + reason (binary still in memory)

### Sprint 4: Phase 6 Integration (post Phase 6)

13. **Update Phase 6 CI/CD** (.github/workflows/build.yml)
    - After building release binaries, compute SHA256 for each
    - Upload both binary + `.sha256` file to GitHub Release assets
    - Verify naming: `coupon-finder-{platform}-{arch}` + `.sha256` extension

---

## Files to Create/Modify

**New:**
- `src/version.ts` (generated constant)
- `src/utils/platform.ts`
- `src/utils/install.ts`
- `src/utils/releases.ts`
- `src/utils/download.ts`
- `src/utils/checksum.ts`
- `src/utils/lock.ts`
- `src/commands/update.ts`

**Modify:**
- `src/cli.ts` (add update command routing, use version.ts for --version)
- `package.json` (keep version in sync with src/version.ts)
- `Makefile` (add `make update`, `make update-test-*`)
- `README.md` (document update command + workflow)
- `docs/api-reference.md` (document update command)

**CI/CD (Phase 6):**
- `.github/workflows/build.yml` (generate SHA256 checksums)

---

## Success Criteria

- [ ] User can run `coupon-finder update` and see interactive menu of available versions
- [ ] User can select a version (including older versions for downgrade)
- [ ] On selection, binary is downloaded, SHA256 verified, atomically replaced, backup created
- [ ] If checksum fails, temp file deleted and current binary untouched
- [ ] If parallel update running, second invocation exits with lock message
- [ ] On success, user sees: `✓ Updated: v0.1.0 → v0.2.0` + restart reminder
- [ ] Shell restart required before new version takes effect (confirm with manual test)
- [ ] Unsupported platforms (Windows, etc.) fail fast with reinstall message
- [ ] Wrapper/source install layouts fail fast with reinstall message

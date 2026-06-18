# Phase 7: CLI Version Management (`coupon-finder update`)

**Estimated Time:** 8-10 hours (4 sprints)  
**Goal:** Interactive version manager with atomic replacement, SHA256 verification, and safe rollback  
**Depends On:** Phase 6 must deliver compiled binaries + `.sha256` files in GitHub Releases

**Full Architecture:** See `/PLAN.md` for 12 Codex findings, decision tables, and prerequisites

---

## Prerequisites (Phase 6 Output)

Phase 7 requires these artifacts from Phase 6:
- [ ] Compiled binaries: `coupon-finder-{platform}-{arch}` (darwin-x64, darwin-arm64, linux-x64)
- [ ] Checksum files: `coupon-finder-{platform}-{arch}.sha256` (64 hex chars, single line)
- [ ] No draft/prerelease artifacts in GitHub Releases

**Validation:** Phase 7 must fail gracefully if Phase 6 assets are missing.

---

## Sprint 1: Core Utilities & Versioning (3 hours)

### 1. Version Module
- [ ] Create `src/version.ts` — single source of truth
  ```typescript
  export const VERSION = "0.1.0";
  ```
- [ ] Update `src/cli.ts` to use `src/version.ts` for `--version` flag
- [ ] Keep `package.json` version in sync (manual for now)

### 2. Platform Detection & Validation
- [ ] Create `src/utils/platform.ts`
  - [ ] `getPlatformArch()` → `darwin-x64 | darwin-arm64 | linux-x64 | error`
  - [ ] `validatePlatform()` → throw on Windows, unsupported platforms
  - [ ] Supported matrix: darwin Intel/ARM, Linux x64 only

### 3. Install Layout & Permissions
- [ ] Create `src/utils/install.ts`
  - [ ] `resolveInstalledBinary()` — use `process.execPath`, validate regular file + writable dir
  - [ ] `validateInstallLayout()` — refuse wrapper/source-only installs
  - [ ] `checkWritePermissions()` — temp file probe (create, write, rename, delete in install dir)

### 4. GitHub Release Client
- [ ] Create `src/utils/releases.ts`
  - [ ] `fetchReleases()` — paginated API, exclude drafts, sort by semver descending
  - [ ] `filterCompatibleAssets()` — find binary + checksum for current platform
  - [ ] `createReleaseMenu()` — format versions for interactive selection

### 5. Download & Temp Management
- [ ] Create `src/utils/download.ts`
  - [ ] `downloadToTemp()` — timeouts: 10s conn, 30s per-chunk, 5min total
  - [ ] `retryDownload()` — 3x with exponential backoff (1s, 2s, 4s)
  - [ ] `cleanupTemp()` — safe temp file deletion

### 6. SHA256 Verification
- [ ] Create `src/utils/checksum.ts`
  - [ ] `parseChecksum()` — strict: exactly 64 hex chars, optional filename match
  - [ ] `computeSHA256()` — stream-based, not memory buffered
  - [ ] `verifyChecksum()` — compare hashes, fail on mismatch

---

## Sprint 2: Update Command & Concurrency (2.5 hours)

### 7. Lock File Management
- [ ] Create `src/utils/lock.ts`
  - [ ] `acquireLock()` — create lock file with PID + timestamp, 10min TTL
  - [ ] `releaseLock()` — delete lock, fail gracefully if stale
  - [ ] Used to prevent parallel updates corrupting state

### 8. Main Update Command
- [ ] Create `src/commands/update.ts` — implement 19-step flow:
  1. Load current version from `src/version.ts`
  2. Detect platform/arch → fail if unsupported
  3. Resolve installed binary → fail if wrapper/source layout
  4. Acquire update lock
  5. Fetch releases (paginated, sorted, filtered)
  6. Display interactive menu (numbered: `[1] v0.2.0  [2] v0.1.0 ...`)
  7. User selects version
  8. If already latest → silent exit
  9. Check permissions (temp probe)
  10. If denied → warn `sudo coupon-finder update`, exit
  11. Download binary + checksum to temp
  12. Verify checksum (strict parsing, compare hashes)
  13. On failure → cleanup temp, show error, release lock, exit
  14. Backup current binary to `.coupon-finder-backup-{timestamp}.bak`
  15. Atomically replace: chmod +x → fsync → rename (same filesystem)
  16. On rename failure → restore from backup, cleanup, release lock, exit
  17. On success → delete oldest backup (keep latest 1)
  18. Show summary: `✓ Updated: v0.1.0 → v0.2.0`
  19. Release lock, remind: `⚠️  Restart your shell to use the new version`

- [ ] Comprehensive error handling + logging at each step
- [ ] No corrupted/truncated binaries left behind (atomic or fully rolled back)

---

## Sprint 3: Integration & Documentation (2.5 hours)

### 9. CLI Integration
- [ ] Update `src/cli.ts` to register `update` command in routing
- [ ] Test: `bun run src/cli.ts update --help`

### 10. Makefile Targets
- [ ] Add `make update` — runs `bun run src/cli.ts update` for manual testing
- [ ] Add `make update-test-downgrade` — test downgrade scenario (if versions exist)

### 11. Documentation
- [ ] Update `README.md` — Add "Update" section with command + workflow
- [ ] Update `docs/api-reference.md` — Document `coupon-finder update` command + error messages
- [ ] Note shell restart requirement (binary still in memory)

### 12. Manual Testing
- [ ] [ ] Test platform detection (macOS Intel, macOS ARM, Linux)
- [ ] [ ] Test interactive menu selection
- [ ] [ ] Test checksum verification (success + mismatch scenarios)
- [ ] [ ] Test permissions check (writable + read-only dirs)
- [ ] [ ] Test atomic replacement + backup creation
- [ ] [ ] Test parallel updates (lock file prevents second invocation)
- [ ] [ ] Test shell restart requirement (binary in use until new shell)
- [ ] [ ] Test error messages (unsupported platform, wrapper install, network failure)

---

## Sprint 4: Phase 6 Integration (Post Phase 6 Release)

### 13. CI/CD Checksum Generation
- [ ] Update `.github/workflows/build.yml` (Phase 6 workflow)
  - [ ] After building release binaries, compute SHA256 for each
  - [ ] Upload both binary + `.sha256` file to GitHub Release assets
  - [ ] Verify naming: `coupon-finder-{platform}-{arch}` + `.sha256` extension
  - [ ] Example `.sha256` format: `abc123...def456  coupon-finder-darwin-x64`

---

## Success Criteria

- [ ] User can run `coupon-finder update` and see interactive menu of available versions
- [ ] User can select a version (including downgrade to older versions)
- [ ] Binary is downloaded, SHA256 verified, atomically replaced with backup created
- [ ] If checksum fails, temp file deleted and current binary untouched
- [ ] If parallel update running, second invocation exits with clear lock message
- [ ] On success: `✓ Updated: v0.1.0 → v0.2.0` + restart reminder
- [ ] Shell restart required before new version takes effect (confirmed via manual test)
- [ ] Unsupported platforms (Windows, etc.) fail fast with reinstall message
- [ ] Wrapper/source install layouts fail fast with reinstall message
- [ ] Permissions denied shows helpful `sudo coupon-finder update` suggestion

---

## Key Decision Tradeoffs (Locked via Codex Review)

| Decision | Chosen | Why |
|----------|--------|-----|
| Version source | `src/version.ts` + GitHub API | Single source of truth |
| Update type | Atomic in-place replacement | Standard, minimal state |
| Selection UI | Interactive menu (numbered) | User-friendly, discoverable |
| Verification | SHA256 checksums | Standard, manually verifiable |
| Failure behavior | Atomic replace + backup restore | Safest: full success or no change |
| Permissions check | Temp file probe in install dir | Proves write+rename capability |
| Already latest | Silent exit (no-op) | Non-disruptive, fast path |
| Downgrade support | Allowed (full semver sort) | Flexibility for bug workarounds |
| Concurrency | Lock file with PID + TTL | Prevents corrupted state |

---

## Out of Scope (Phase 7)

- ❌ Automatic background updates
- ❌ Update notifications/banners
- ❌ Changelog display (`--changelog` flag)
- ❌ Offline updates / local cache
- ❌ Non-GitHub sources
- ❌ GPG/code signing (SHA256 only)
- ❌ Automatic rollback on error

---

## Open Questions (Future Phases)

1. **GitHub API rate limiting** — Unauthenticated: 60 req/hour
   - v0: No caching, users rarely update → acceptable
   - v1: Cache release list for 1 hour, or accept GitHub token from env

2. **Prerelease handling** — Include beta/RC versions?
   - v0: Exclude (stable releases only) → document in help
   - v1: Add `--include-prerelease` flag if demand exists

3. **Backup retention** — How many old binaries to keep?
   - v0: Keep latest 1 backup only → delete on successful next update
   - v1: Config option for backup count

---

## Files to Create/Modify

**New:**
- `src/version.ts`
- `src/utils/platform.ts`
- `src/utils/install.ts`
- `src/utils/releases.ts`
- `src/utils/download.ts`
- `src/utils/checksum.ts`
- `src/utils/lock.ts`
- `src/commands/update.ts`

**Modify:**
- `src/cli.ts` (add update routing, use version.ts)
- `package.json` (sync version with src/version.ts)
- `Makefile` (add update targets)
- `README.md` (document update command)
- `docs/api-reference.md` (document command)

**CI/CD (Phase 6):**
- `.github/workflows/build.yml` (generate SHA256 checksums)

---

## After Phase 7

✅ Full self-update capability  
✅ Users can downgrade/upgrade to any version  
✅ Safe atomic replacement with rollback  
✅ Comprehensive error handling  

**Next (Phase 8+):**
- Update notification on startup (optional banner)
- Coupon expansion improvements
- Scheduled/automatic claiming
- Multi-version management

---

**Full Architecture Details:** See `/PLAN.md` (locked via Codex Review with 12 concrete findings)

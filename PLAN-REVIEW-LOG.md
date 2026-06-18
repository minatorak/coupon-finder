# Plan Review Log: Phase 7 — CLI Version Management

**Act 1 (Grill) complete** — plan locked with the user via 11 targeted questions.

**MAX_ROUNDS=5**

---

## Grill Summary (11 Questions Locked)

1. ✅ **Scope** → Interactive `coupon-finder update` with version selection
2. ✅ **Version source** → GitHub Releases API
3. ✅ **Update mechanism** → In-place replacement
4. ✅ **Selection UI** → Interactive menu (numbered list)
5. ✅ **Current version detection** → Read from `package.json`
6. ✅ **Update process** → With SHA256 checksum verification
7. ✅ **Verification method** → Dedicated `.sha256` files in releases
8. ✅ **Success behavior** → Show summary + restart message
9. ✅ **Error handling** → Rollback automatically
10. ✅ **Permissions** → Check first, warn if sudo needed
11. ✅ **Edge cases** → Allow downgrade, silent no-op if latest, no offline cache

---

## Act 2 — Codex Review (starting...)

**Verdict: REVISE**

Concrete flaws found:

1. **Release artifact mismatch** — `install.sh` currently installs source plus a wrapper, while the plan assumes compiled GitHub release binaries and `.sha256` assets.  
   **One-line fix:** Gate Phase 7 on Phase 6 producing real compiled assets, or revise Phase 7 to update the source install layout (`/usr/local/.coupon-finder` + wrapper).

2. **Current-version detection is unreliable for compiled installs** — the plan says read `package.json`, but a single compiled binary may not have `package.json` beside it, and `src/cli.ts` currently uses a hardcoded `VERSION`.  
   **One-line fix:** Add a single version source, such as generated `src/version.ts`, and have both `--version` and `update` read it.

3. **Installer path detection is underspecified** — `which coupon-finder` may resolve a wrapper, symlink, PATH shadow, or source install instead of the binary that should be replaced.  
   **One-line fix:** Resolve the invoked executable path, detect whether it is a compiled binary or wrapper install, and refuse unsupported layouts with a clear reinstall message.

4. **Permission check is too shallow** — checking only the install directory does not prove the existing executable can be replaced, renamed, or restored.  
   **One-line fix:** Check write/rename capability in the target directory and the target file, using a same-directory temporary probe.

5. **Replacement is not atomic** — copying directly over the current executable can leave a truncated or corrupt CLI on crash, disk-full, or interrupted writes.  
   **One-line fix:** Download to a temp file, verify it, chmod it, then atomically rename it into place from the same filesystem, keeping a backup until success.

6. **Rollback policy contradicts itself** — the plan says "auto-rollback" but later says automatic rollback is out of scope and backup is optional.  
   **One-line fix:** Choose one policy; recommended v0 is atomic replace plus backup restore on failed rename/install, with no rollback needed for download/verify failures.

7. **`retryWithTimeout` is not suitable for binary downloads as-is** — the existing helper defaults to a 5s total timeout, which can fail valid large release downloads.  
   **One-line fix:** Use update-specific fetch retry settings with separate connection and download timeouts, progress-independent cleanup, and clear network error messages.

8. **Checksum parsing needs stricter validation** — accepting arbitrary `.sha256` contents risks comparing the wrong hash or trusting malformed data.  
   **One-line fix:** Require exactly one 64-hex SHA256 value and, if a filename is present, require it to match the selected asset basename.

9. **Platform/asset mapping is incomplete** — the plan mentions macOS/Linux but not exact `os.platform()` values, unsupported Windows behavior, or asset naming compatibility with Phase 6.  
   **One-line fix:** Define an explicit platform matrix (`darwin-x64`, `darwin-arm64`, `linux-x64`) and fail fast for unsupported platforms.

10. **GitHub release selection semantics are missing** — "fetch all releases" does not define draft/prerelease handling, semver sorting, pagination, or missing-asset filtering.  
    **One-line fix:** Page through releases, exclude drafts, decide whether prereleases are shown, sort by semver/date explicitly, and only show versions with matching binary + checksum assets.

11. **No concurrency guard** — two simultaneous `coupon-finder update` runs can race and corrupt backups or replacement state.  
    **One-line fix:** Acquire a lock file in the install directory or user cache before download/install and exit with a clear "update already running" message.

12. **Observability is underplanned** — failures during API lookup, asset matching, checksum mismatch, and install replacement need actionable context.  
    **One-line fix:** Log selected version, asset name, target path, temp path, and failure category while avoiding tokens or full GitHub response dumps.

Recommended plan changes:

- Add a "Phase 6 prerequisite" section requiring compiled release assets and checksum assets before Phase 7 implementation.
- Replace "read current version from package.json" with a generated/bundled version module used by both CLI output and update logic.
- Specify atomic install mechanics: same-directory temp file, checksum, chmod, fsync where available, rename, backup cleanup.
- Define supported install layouts; for unsupported/source-wrapper installs, tell the user to reinstall instead of attempting self-update.
- Add focused tests for platform mapping, release filtering, checksum parsing, permission failures, and atomic replacement failure paths.

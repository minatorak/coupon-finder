# Build, installation, and release plan

## Objective

Ship a self-contained `coupon-finder` executable for macOS Apple Silicon,
macOS Intel, and Linux x64. A user installs it with one shell command, opens a
new terminal, and can run `coupon-finder` without Bun or `sudo`.

## Decisions already made

| Area | Decision |
| --- | --- |
| Installation artifact | Bun-compiled executable from GitHub Releases |
| First release targets | `darwin-arm64`, `darwin-x64`, `linux-x64` |
| Android/Termux | Deferred and reported as unsupported |
| Install location | `~/.local/bin/coupon-finder` |
| PATH | Idempotent labelled block in detected zsh or bash startup file |
| Release trigger | Push a `vX.Y.Z` tag |
| Integrity | SHA-256 manifest signed with RSA; verified with OpenSSL |
| Browser runtime | Use an existing supported system browser; do not download one |

See ADRs 0001–0007 for the rationale.

## Release asset contract

For a `vX.Y.Z` release, publish exactly these assets:

```text
coupon-finder-darwin-arm64
coupon-finder-darwin-x64
coupon-finder-linux-x64
checksums.txt
checksums.txt.sig
```

`checksums.txt` contains one SHA-256 hash and exact asset name per line. Its
detached RSA signature is `checksums.txt.sig`. The public PEM key is committed
in the installer and application source; the private key is stored only as a
protected GitHub Actions secret.

## Work plan

### Phase 0 — Establish a distributable baseline

1. Make `package.json`, `src/version.ts`, and the release tag agree on one
   semantic version. Add a CI check that fails on a mismatch.
2. Replace the current browser-default `bun build --outdir` script with a
   release build entrypoint using `bun build --compile --target` and explicit
   `--outfile` names.
3. Run a proof build on each native runner before any release workflow is
   trusted. The proof must expose and resolve the current Playwright bundling
   resolution failure before release work begins.
4. Remove or justify unused production dependencies, notably `better-sqlite3`,
   so compiled artifacts contain only required native code.

Exit criterion: each target produces an executable; `--help` and `--version`
work on its matching OS and architecture.

### Phase 1 — Make the application portable as a binary

1. Separate release-binary execution from `bun run src/cli.ts` development
execution. Give the compiled binary an explicit release marker so `update`
cannot treat Bun's own executable as `coupon-finder`.
2. Change install-layout validation to resolve the running executable and accept
only the installed release binary. Source-mode `update` must fail safely with a
reinstall/update guidance message.
3. Replace Playwright-managed browser launches with platform-aware discovery of
installed Firefox, Chrome, and Brave executables. Emit one actionable preflight
error when the configured browser is absent.
4. Make session-cookie location discovery platform-aware. Add the Linux Firefox,
Chrome, and Brave locations alongside the existing macOS locations, then cover
them with unit tests using temporary home directories.
5. Keep Android/Termux out of the platform switch. Detect it or unsupported
architectures early and return a clear unsupported-platform error.

Exit criterion: no path in a release binary launches a Playwright-managed
browser or writes outside the user's application and temporary directories.

### Phase 2 — Replace `install.sh`

1. Rewrite the installer as a Bash script with `set -euo pipefail` and preflight
checks for `curl`, `openssl`, `mktemp`, and a supported OS/architecture.
2. Map `Darwin/arm64`, `Darwin/x86_64`, and `Linux/x86_64` to the exact asset
names. Reject Android, Linux ARM64, unknown CPU architectures, and unsupported
shell environments before downloading.
3. Download the selected binary, `checksums.txt`, and `checksums.txt.sig` to a
private temporary directory. Verify the manifest's RSA signature with the
embedded PEM public key, then verify the selected file's SHA-256 entry.
4. Install atomically into `~/.local/bin`: write a unique temporary file in the
same directory, set mode `0755`, then rename it to `coupon-finder`. Do not use
`sudo`, `/usr/local`, source copies, or wrapper scripts.
5. Detect zsh or bash from `$SHELL`, append a labelled PATH block only when it
is absent, and preserve every existing line in the rc file. For another shell,
complete the install but print the exact export command instead of editing a
file.
6. Tell the user to open a new terminal. Do not source their rc file from the
installer. Run the installed binary's `--version` only when it is already on
the current PATH; otherwise verify it by absolute path.

Exit criterion: a clean supported host can run the installer twice without
duplicate PATH entries or partial binaries; a tampered binary, manifest, or
signature never reaches `~/.local/bin`.

### Phase 3 — Build, sign, and publish releases

1. Add a tag-triggered GitHub Actions workflow with a native build matrix:
   macOS ARM64, macOS Intel, and Ubuntu x64. Use the locked dependency set and
   run type checks and unit tests before build jobs publish artifacts.
2. Compile with the target-appropriate Bun runtime on each runner. Smoke-test
   each generated executable with `--version` and `--help` on that runner.
3. Gather the three artifacts in a protected publish job, generate a stable
   sorted `checksums.txt`, and create an RSA/SHA-256 detached signature using
   the protected private-key secret.
4. Re-verify the signature and all three hashes in the publish job, then create
   the GitHub Release for the tag and upload only the five contract assets.
5. Grant the workflow minimum required `contents: write` permission. Fail if a
   release already exists, a version differs from the tag, or any expected
   artifact is missing.

Exit criterion: pushing a valid version tag produces one verified GitHub
Release; an invalid build, test, version, or signing step publishes nothing.

### Phase 4 — Align `coupon-finder update`

1. Change release discovery to require the exact binary, checksum manifest, and
signature assets. Ignore incomplete, draft, and prerelease releases according
to the selected release policy.
2. Reuse the same embedded public key and verification implementation as the
installer: verify signature first, then the selected asset hash.
3. Keep atomic replacement and rollback, but fix backup discovery so it matches
the actual backup filenames and retains exactly one previous binary.
4. Test source mode, wrong binary name, non-writable directory, expired lock,
download failure, invalid signature, invalid checksum, failed rename, rollback,
and successful upgrade/downgrade.

Exit criterion: source-mode invocation can never modify Bun; installed binaries
only change after both signature and hash verification pass.

### Phase 5 — Documentation and acceptance testing

1. Replace README installation claims with the release-binary flow, prerequisites
(`curl`, `openssl`, zsh/bash PATH handling, and an installed supported browser),
supported platforms, Android deferral, and `update` behavior.
2. Add a troubleshooting section for PATH, unsupported architecture, missing
OpenSSL, missing browser, invalid signature, and failed self-update.
3. Test clean-install, reinstall, upgrade, and corruption rejection on each of
the three supported target runners. Confirm that the user only needs to reopen
the terminal after install.

## Non-goals for this release

- Android/Termux binaries or browser/session support
- Windows builds
- System-wide `/usr/local` installation
- Installer-managed Playwright browser downloads
- Unsigned release assets

## Delivery order

Complete Phases 0 and 1 before writing the installer. Complete Phase 2 before
adding automatic publishing. Enable tag-triggered releases only after Phase 4
passes its negative-path tests. Phase 5 is the release gate.

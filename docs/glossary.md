# Distribution glossary

- **Release Archive**: A target-specific `.tar.gz` containing one
  `coupon-finder/` package tree and published as a GitHub Release asset.
- **Runtime**: The Bun-compiled `bin/coupon-finder-runtime` executable.
- **Launcher**: `~/.local/bin/coupon-finder`; it sets the install root,
  packaged-only `NODE_PATH`, and dedicated browser path before executing the
  current runtime.
- **Install Root**: `~/.local/share/coupon-finder`, which owns releases,
  `current`, update locks, and downloaded browsers.
- **Immutable Release**: A verified directory below `releases/` named from its
  version, target, and archive hash prefix. It is never edited in place.
- **Current Symlink**: The atomically replaced `current` link selecting the
  immutable release used by every new launcher invocation.
- **Dedicated Browser Cache**: The coupon-finder-only `browsers/` directory
  under the install root. Uninstall removes it.
- **Legacy Layout**: The v0.1.0/v0.2.0 single executable and adjacent lock or
  backup files. It is unsupported by the archive updater and removable by
  `uninstall.sh`.
- **Managed PATH block**: The labelled installer-owned shell configuration
  block. Installer and uninstaller do not change content outside its markers.
- **Signed checksum manifest**: `checksums.txt` plus its detached RSA/SHA-256
  signature, verified before an archive checksum is trusted.
- **Supported targets**: `darwin-arm64`, `darwin-x64`, and `linux-x64`.

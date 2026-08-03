# Distribution glossary

- **Release binary**: A standalone executable compiled with Bun for one
  platform and architecture, published as a GitHub Release asset.
- **Installer**: `install.sh`, which selects, verifies, and installs a release
  binary.
- **Development run**: Executing TypeScript from the repository with Bun; this
  is not an installed end-user distribution.
- **Update layout**: An installation in which `coupon-finder` itself is the
  executable replaced by `coupon-finder update`.
- **Supported desktop targets**: `darwin-arm64`, `darwin-x64`, and `linux-x64`
  in the first binary release.
- **Deferred Android support**: Android/Termux is intentionally unsupported in
  the first release; a Linux ARM64 executable is not an Android artifact.
- **Managed PATH block**: A labelled installer-owned shell configuration block
  that adds `~/.local/bin` to `PATH` exactly once without altering user content.
- **Release tag**: A Git tag in the form `vX.Y.Z` that authoritatively triggers
  the build, checksum, and GitHub Release workflow.
- **Signed checksum manifest**: The release-wide SHA-256 manifest plus a
  detached signature, verified before trusting a binary checksum.
- **Release public key**: The PEM public key embedded in the installer and
  updater; it verifies the CI-produced RSA signature on a checksum manifest.
- **System browser**: An existing Firefox, Chrome, or Brave executable selected
  by the application; Playwright-managed browser downloads are not installed.

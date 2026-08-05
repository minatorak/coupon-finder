# Releasing coupon-finder

A pushed `vX.Y.Z` tag builds and publishes exactly five assets:

```text
coupon-finder-darwin-arm64.tar.gz
coupon-finder-darwin-x64.tar.gz
coupon-finder-linux-x64.tar.gz
checksums.txt
checksums.txt.sig
```

Each archive has one `coupon-finder/` root containing `RELEASE`, the launcher,
the compiled Bun runtime, and locked `playwright`/`playwright-core` packages.
Browser binaries are deliberately excluded and downloaded to the dedicated
cache on first use.

Configure `RELEASE_SIGNING_PRIVATE_KEY` with the PEM private key matching
`keys/release-public.pem`. The workflow builds natively, extracts outside the
checkout, runs `--release-smoke` with a clean home and packaged dependencies,
scans for checkout paths, signs and re-verifies all archives, enforces the
exact asset count, then exercises install and uninstall before publishing.

Local gates:

```bash
bun install --frozen-lockfile
bun run check:version
bun run check:release-key
bunx tsc --noEmit
bun test
bun run build:release -- --target darwin-x64
```

The tag must match `package.json` and `src/version.ts`. Release v0.2.1 with a
new tag; do not modify or rebuild assets attached to `v0.2.0`.

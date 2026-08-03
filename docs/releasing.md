# Releasing coupon-finder

Releases are created by pushing an exact `vX.Y.Z` tag. The workflow builds the
three native executables, creates `checksums.txt`, signs it with RSA/SHA-256,
re-verifies every asset, and publishes the five-file release contract.

Before the first release, configure the repository secret
`RELEASE_SIGNING_PRIVATE_KEY` with the PEM private key that corresponds to
`keys/release-public.pem`. Keep the private key outside the repository and only
store it in the protected GitHub Actions secret.

Local checks before tagging:

```bash
bun install --frozen-lockfile
bun run check:version
bunx tsc --noEmit
bun test
bun run build:release -- --target darwin-arm64
```

The tag must match `package.json` and `src/version.ts`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow deliberately fails if the tag/version differs, an expected
executable is missing, signature verification fails, or the GitHub Release
already exists.

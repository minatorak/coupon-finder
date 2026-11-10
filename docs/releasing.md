# Releasing

Pushing version tag triggers `.github/workflows/build.yml`. Workflow validates source, builds three native executables, signs checksum manifest, verifies release contract, then publishes GitHub Release.

## Prerequisites

Repository release environment must contain `RELEASE_SIGNING_PRIVATE_KEY`. Value is PEM private key matching `keys/release-public.pem`.

Keep private key outside repository. Installer and updater contain only public key.

Version must match in:

- Git tag, such as `v0.1.0`
- `package.json`
- `src/version.ts`

## Local checks

From clean dependency state:

```bash
bun install --frozen-lockfile
bun run check:version
bun run check:release-key
bunx tsc --noEmit
bun test --pass-with-no-tests
bun run build:release -- --target darwin-arm64
```

Replace target for local host or desired artifact check.

## Publish

Create exact tag matching source version:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow runs three stages:

1. **Quality** — locked install, version check, release-key consistency, type check, tests.
2. **Build** — compile and smoke-test each supported executable.
3. **Publish** — assemble assets, sign and re-verify manifest, reject existing release, publish verified tag.

## Release asset contract

Every stable release must contain exactly:

```text
coupon-finder-darwin-arm64
coupon-finder-darwin-x64
coupon-finder-linux-x64
checksums.txt
checksums.txt.sig
```

Missing, duplicate, unsigned, or unexpected asset fails workflow contract.

## Installer trust flow

`install.sh`:

1. Detects supported platform.
2. Downloads platform executable, manifest, and signature from latest release.
3. Verifies manifest signature using embedded release public key.
4. Verifies executable SHA-256 against signed manifest.
5. Installs executable to `~/.local/bin/coupon-finder`.
6. Adds managed PATH block for supported zsh or bash startup file.

Installer rejects unsupported platforms and does not use `sudo`.

## Updater trust flow

Installed `coupon-finder update` lists stable compatible releases and permits selecting newer or older version. It repeats signature and checksum verification before changing executable.

Updater creates timestamped backup beside executable, keeps newest backup, and uses same-directory rename for atomic replacement. It restores backup when replacement fails.

Development invocation is rejected because updater only supports installed executable named `coupon-finder`.

## Distribution glossary

**Release binary**  
Standalone executable compiled with Bun for one platform and architecture.

**Installer**  
`install.sh`, which selects, verifies, and installs latest compatible release binary.

**Development run**  
TypeScript executed directly from repository with Bun; not installed end-user distribution.

**Update layout**  
Installation where executable itself is replaced by `coupon-finder update`.

**Supported desktop targets**  
`darwin-arm64`, `darwin-x64`, and `linux-x64`.

**Managed PATH block**  
Installer-owned marked shell configuration block adding `~/.local/bin` once.

**Release tag**  
Git tag in `vX.Y.Z` form that triggers build and publication.

**Signed checksum manifest**  
Release-wide SHA-256 manifest and detached RSA/SHA-256 signature verified before trusting executable checksum.

**Release public key**  
PEM public key embedded in installer and updater for verifying CI-produced manifest signature.

## Failure checks

Before retrying failed release, inspect exact workflow stage. Common blockers:

- tag differs from source version;
- private signing secret missing or mismatched;
- build target missing;
- signature or checksum verification fails;
- release for tag already exists.

Do not bypass signature or checksum validation to publish release.

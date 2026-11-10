# ADR 0001: Self-contained release archives

Status: Accepted for v0.2.1

## Context

The v0.2.0 Bun executable embedded Playwright code that retained absolute
dependency paths from the build checkout. Lazy Playwright and
`playwright-core` loads could therefore work on a runner but fail on a user's
machine. A single executable also provided no stable place for those runtime
packages or browser metadata.

## Options considered

1. Patch the compiled single binary and every dynamic import path.
2. Require users to install external Playwright dependencies globally.
3. Publish an archive containing a Bun runtime plus locked dependencies.

Patching is coupled to Bun and Playwright internals. Global dependencies make
resolution non-deterministic and push compatibility work onto users. The
archive is larger, but it can be inspected, smoke-tested, and resolved without
the build machine or a package manager.

## Decision

Publish one signed `.tar.gz` per supported target. Externalize `playwright` and
`playwright-core` from the compiled runtime and package their locked directories
beside it. Install verified packages as immutable release directories and
atomically switch a `current` symlink. A stable launcher replaces ambient
`NODE_PATH`, sets a dedicated Playwright browser cache, and runs the selected
runtime.

Browser binaries remain on-demand downloads. Successful updates delete the old
release; rollback retains it only until the post-switch smoke test succeeds.

## Consequences

Release assets are larger and install/update require `tar`. Packaging and CI
must validate archive paths, metadata, dependencies, smoke behavior, hashes,
and signatures. In return, installed dependency resolution is deterministic,
updates are atomic, and uninstall can cleanly remove all application-owned
runtime and browser state.

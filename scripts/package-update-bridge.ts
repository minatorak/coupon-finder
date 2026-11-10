/**
 * Package a built executable as the v0.2.1-era update archive so installed
 * v0.2.x updaters can still discover and install new releases.
 *
 * The v0.2.1 updater only accepts `coupon-finder-<platform>.tar.gz` assets
 * containing a `coupon-finder/` package with a RELEASE metadata file, a
 * launcher script, `bin/coupon-finder-runtime`, and the packaged playwright
 * libraries. This script builds exactly that layout from the bare compiled
 * binary and verifies the result against the same rules the old updater
 * applies (entry paths, no links, required files, runtime smoke).
 */
import { constants } from "fs";
import { access, cp, chmod, mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { tmpdir } from "os";

interface Args {
  target: string;
  binary: string;
  outputDir: string;
}

const TARGETS = new Set(["darwin-arm64", "darwin-x64", "linux-x64"]);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function usage(): never {
  console.error(
    "Usage: bun run scripts/package-update-bridge.ts -- --target <darwin-arm64|darwin-x64|linux-x64> [--binary <path>] [--output-dir <dir>]"
  );
  process.exit(2);
}

function parseArgs(): Args {
  const args = Bun.argv.slice(2);
  let target: string | undefined;
  let binary: string | undefined;
  let outputDir = "dist/release";
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--target") target = args[++index];
    else if (args[index] === "--binary") binary = args[++index];
    else if (args[index] === "--output-dir") outputDir = args[++index];
    else usage();
  }
  if (!target || !TARGETS.has(target)) usage();
  binary ??= join(outputDir, `coupon-finder-${target}`);
  return { target, binary: resolve(binary), outputDir: resolve(outputDir) };
}

const projectRoot = resolve(import.meta.dir, "..");
const { target, binary, outputDir } = parseArgs();

const packageJson = JSON.parse(
  await Bun.file(join(projectRoot, "package.json")).text()
);
const version: string = packageJson.version;
if (!SEMVER.test(version)) {
  throw new Error(`Invalid package version: ${version}`);
}
await access(binary, constants.X_OK);

const staging = await mkdtemp(join(tmpdir(), "bridge-"));
const packageRoot = join(staging, "coupon-finder");
try {
  await mkdir(join(packageRoot, "bin"), { recursive: true });
  await mkdir(join(packageRoot, "lib/node_modules/playwright-core/lib"), {
    recursive: true,
  });

  const metadata = `format=1\nversion=${version}\ntarget=${target}\n`;
  await writeFile(join(packageRoot, "RELEASE"), metadata);

  // Launcher script: identical content to the v0.2.1 installer launcher.
  const launcher = `#!/usr/bin/env bash
set -euo pipefail
INSTALL_ROOT="\${HOME}/.local/share/coupon-finder"
export COUPON_FINDER_INSTALL_ROOT="\${INSTALL_ROOT}"
export NODE_PATH="\${INSTALL_ROOT}/current/lib/node_modules"
export PLAYWRIGHT_BROWSERS_PATH="\${INSTALL_ROOT}/browsers"
exec "\${INSTALL_ROOT}/current/bin/coupon-finder-runtime" "$@"
`;
  await writeFile(join(packageRoot, "bin/coupon-finder"), launcher);

  await cp(binary, join(packageRoot, "bin/coupon-finder-runtime"));
  await chmod(join(packageRoot, "bin/coupon-finder-runtime"), 0o755);
  await chmod(join(packageRoot, "bin/coupon-finder"), 0o755);

  const packagedModules = join(packageRoot, "lib/node_modules");
  await cp(
    join(projectRoot, "node_modules/playwright/package.json"),
    join(packagedModules, "playwright/package.json")
  );
  for (const relative of [
    "package.json",
    "browsers.json",
    "lib/coreBundle.js",
  ]) {
    await cp(
      join(projectRoot, "node_modules/playwright-core", relative),
      join(packagedModules, "playwright-core", relative)
    );
  }

  const archivePath = join(outputDir, `coupon-finder-${target}.tar.gz`);
  const archive = Bun.spawnSync(
    ["tar", "-czf", archivePath, "-C", staging, "coupon-finder"],
    { stdout: "ignore", stderr: "pipe", env: { ...process.env, COPYFILE_DISABLE: "1" } }
  );
  if (!archive.success) {
    throw new Error(
      `tar failed: ${new TextDecoder().decode(archive.stderr) || "unknown error"}`
    );
  }

  // Verify the archive the way the v0.2.1 updater does.
  const entries = Bun.spawnSync(["tar", "-tzf", archivePath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!entries.success) throw new Error("Archive is unreadable.");
  const names = new TextDecoder()
    .decode(entries.stdout)
    .split(/\r?\n/)
    .filter(Boolean);
  if (names.length === 0) throw new Error("Archive is empty.");
  for (const name of names) {
    if (name !== "coupon-finder" && !name.startsWith("coupon-finder/")) {
      throw new Error(`Archive entry outside package: ${name}`);
    }
  }
  const verbose = Bun.spawnSync(["tar", "-tvzf", archivePath], {
    stdout: "pipe",
    stderr: "pipe",
  });
  for (const line of new TextDecoder().decode(verbose.stdout).split(/\r?\n/)) {
    if (line.startsWith("l") || line.startsWith("h")) {
      throw new Error("Archive contains an unsupported link entry.");
    }
  }

  const extractedRuntime = join(packageRoot, "bin/coupon-finder-runtime");
  await access(extractedRuntime, constants.X_OK);
  const smokeRoot = await mkdtemp(join(tmpdir(), "bridge-smoke-"));
  const smoke = Bun.spawnSync([extractedRuntime, "--release-smoke"], {
    env: {
      ...process.env,
      COUPON_FINDER_INSTALL_ROOT: smokeRoot,
      NODE_PATH: join(packageRoot, "lib/node_modules"),
      PLAYWRIGHT_BROWSERS_PATH: join(smokeRoot, "browsers"),
    },
    stdout: "ignore",
    stderr: "pipe",
  });
  await rm(smokeRoot, { force: true, recursive: true });
  if (!smoke.success) {
    throw new Error(
      `Runtime smoke failed: ${new TextDecoder().decode(smoke.stderr)}`
    );
  }

  const hash = new Bun.CryptoHasher("sha256")
    .update(await Bun.file(archivePath).arrayBuffer())
    .digest("hex");
  console.log(`bridge archive: ${archivePath}`);
  console.log(`${hash}  coupon-finder-${target}.tar.gz`);
} finally {
  await rm(staging, { force: true, recursive: true });
}

import { constants, existsSync, lstatSync, readlinkSync, statSync } from "fs";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "fs/promises";
import { join, posix, resolve } from "path";
import { logger } from "./logger";
import { readReleaseMetadata, validateReleaseMetadata, validateTarEntries } from "./release-package";

const REINSTALL = `curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/uninstall.sh | bash -s -- --yes
curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/install.sh | bash`;

export function getInstallRoot(): string {
  const configured = process.env.COUPON_FINDER_INSTALL_ROOT;
  if (!configured) {
    throw new Error(`Unsupported/legacy install layout. Reinstall with:\n${REINSTALL}`);
  }
  return resolve(configured);
}

export function getCurrentReleaseDirectory(): string {
  const root = getInstallRoot();
  const current = join(root, "current");
  if (!lstatSync(current).isSymbolicLink()) throw new Error("current is not a symbolic link");
  const target = resolve(root, readlinkSync(current));
  const releases = resolve(root, "releases");
  if (target !== releases && !target.startsWith(`${releases}/`)) throw new Error("current points outside releases");
  if (!statSync(target).isDirectory()) throw new Error("current release directory is missing");
  return target;
}

export async function checkWritePermissions(): Promise<boolean> {
  const root = getInstallRoot();
  const probe = join(root, `.permission-${process.pid}-${Date.now()}`);
  const renamed = `${probe}.renamed`;
  try {
    await writeFile(probe, "test");
    await rename(probe, renamed);
    await rm(renamed, { force: true });
    return true;
  } catch (error) {
    await Promise.all([rm(probe, { force: true }), rm(renamed, { force: true })]);
    logger.warn(`Write permission check failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

export function validateInstallLayout(): void {
  try {
    const current = getCurrentReleaseDirectory();
    const runtime = join(current, "bin/coupon-finder-runtime");
    if (!statSync(runtime).isFile()) throw new Error("installed runtime is missing");
  } catch (error) {
    throw new Error(`Unsupported/legacy install layout: ${error instanceof Error ? error.message : error}\n${REINSTALL}`);
  }
}

export function validateArchiveSymlink(entry: string, target: string): void {
  if (target.startsWith("/")) throw new Error(`Unsafe archive symlink: ${entry}`);
  const resolved = posix.normalize(posix.join(posix.dirname(entry), target));
  if (resolved !== "coupon-finder" && !resolved.startsWith("coupon-finder/")) {
    throw new Error(`Unsafe archive symlink: ${entry}`);
  }
}

function commandOutput(command: string[]): string {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr).trim() || `${command[0]} failed`);
  return new TextDecoder().decode(result.stdout);
}

export function inspectReleaseArchive(archivePath: string): void {
  const entries = commandOutput(["tar", "-tzf", archivePath]).split(/\r?\n/).filter(Boolean);
  validateTarEntries(entries);
  const verbose = commandOutput(["tar", "-tvzf", archivePath]);
  for (const line of verbose.split(/\r?\n/)) {
    if (line.startsWith("l") || line.startsWith("h")) {
      throw new Error("Release archive contains an unsupported link entry.");
    }
    const link = line.match(/\s(\.?\/?coupon-finder\/\S+) -> (\S+)$/);
    if (link) validateArchiveSymlink(link[1].replace(/^\.\//, ""), link[2]);
  }
}

async function smoke(runtime: string, packageRoot: string, installRoot: string): Promise<void> {
  await access(runtime, constants.X_OK);
  const child = Bun.spawn([runtime, "--release-smoke"], {
    env: {
      ...process.env,
      COUPON_FINDER_INSTALL_ROOT: installRoot,
      NODE_PATH: join(packageRoot, "lib/node_modules"),
      PLAYWRIGHT_BROWSERS_PATH: join(installRoot, "browsers"),
    },
    stdout: "ignore",
    stderr: "pipe",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`Release smoke test failed: ${await new Response(child.stderr).text()}`);
  }
}

export interface InstallArchiveOptions {
  archivePath: string;
  expectedVersion: string;
  expectedTarget: string;
  hashPrefix: string;
}

export async function installReleaseArchive(options: InstallArchiveOptions): Promise<{ newRelease: string; oldRelease?: string }> {
  const root = getInstallRoot();
  const releases = join(root, "releases");
  await mkdir(releases, { recursive: true });
  inspectReleaseArchive(options.archivePath);
  const staging = await mkdtemp(join(root, ".staging-"));
  let newRelease: string | undefined;
  let oldRelease: string | undefined;
  let switched = false;
  try {
    const extract = Bun.spawnSync(["tar", "-xzf", options.archivePath, "-C", staging], { stdout: "ignore", stderr: "pipe" });
    if (!extract.success) throw new Error(`Could not extract release archive: ${new TextDecoder().decode(extract.stderr)}`);
    const packageRoot = join(staging, "coupon-finder");
    const metadata = readReleaseMetadata(join(packageRoot, "RELEASE"));
    validateReleaseMetadata(metadata, options.expectedVersion, options.expectedTarget);
    const runtime = join(packageRoot, "bin/coupon-finder-runtime");
    const launcher = join(packageRoot, "bin/coupon-finder");
    for (const required of [
      runtime, launcher,
      join(packageRoot, "lib/node_modules/playwright/package.json"),
      join(packageRoot, "lib/node_modules/playwright-core/package.json"),
      join(packageRoot, "lib/node_modules/playwright-core/browsers.json"),
      join(packageRoot, "lib/node_modules/playwright-core/lib/coreBundle.js"),
    ]) {
      if (!existsSync(required) || !statSync(required).isFile()) throw new Error(`Release package is missing ${required}`);
    }
    await chmod(runtime, 0o755);
    await chmod(launcher, 0o755);
    await smoke(runtime, packageRoot, root);

    newRelease = join(releases, `${metadata.version}-${metadata.target}-${options.hashPrefix}`);
    if (existsSync(newRelease)) throw new Error(`Release directory already exists: ${newRelease}`);
    await rename(packageRoot, newRelease);
    const current = join(root, "current");
    if (existsSync(current)) oldRelease = resolve(root, await readlink(current));
    const temporaryLink = join(root, `.current-${process.pid}-${Date.now()}`);
    await symlink(posix.join("releases", newRelease.split("/").pop()!), temporaryLink);
    await rename(temporaryLink, current);
    switched = true;
    const defaultRoot = process.env.HOME
      ? resolve(process.env.HOME, ".local/share/coupon-finder")
      : "";
    const installedLauncher = defaultRoot === root
      ? join(process.env.HOME!, ".local/bin/coupon-finder")
      : "";
    await smoke(
      installedLauncher && existsSync(installedLauncher)
        ? installedLauncher
        : join(newRelease, "bin/coupon-finder-runtime"),
      newRelease,
      root,
    );
    return { newRelease, oldRelease };
  } catch (error) {
    if (switched) {
      const current = join(root, "current");
      const rollback = join(root, `.current-rollback-${process.pid}-${Date.now()}`);
      if (oldRelease) {
        await symlink(posix.join("releases", oldRelease.split("/").pop()!), rollback);
        await rename(rollback, current);
      } else {
        await rm(current, { force: true });
      }
    }
    if (newRelease) await rm(newRelease, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

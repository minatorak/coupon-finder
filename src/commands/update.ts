import { existsSync, readdirSync } from "fs";
import { rm } from "fs/promises";
import { join, resolve } from "path";
import { logger } from "../utils/logger";
import { VERSION } from "../version";
import { validatePlatform } from "../utils/platform";
import {
  checkWritePermissions,
  getCurrentReleaseDirectory,
  getInstallRoot,
  installReleaseArchive,
  validateInstallLayout,
} from "../utils/install";
import { filterCompatibleReleases, formatReleaseMenu } from "../utils/releases";
import { downloadToTemp, cleanupTemp } from "../utils/download";
import { computeSHA256, verifyChecksum, verifyManifestSignature } from "../utils/checksum";
import { acquireLock, releaseLock } from "../utils/lock";

async function getUserSelection(prompt: string): Promise<number> {
  return new Promise((resolveSelection) => {
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => resolveSelection(Number.parseInt(data.toString().trim(), 10)));
  });
}

async function cleanupObsoleteReleases(current: string): Promise<void> {
  const releases = join(getInstallRoot(), "releases");
  if (!existsSync(releases)) return;
  for (const name of readdirSync(releases)) {
    const candidate = resolve(releases, name);
    if (candidate === current) continue;
    try {
      await rm(candidate, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`Could not remove obsolete release ${candidate}: ${error}`);
    }
  }
}

export async function update(): Promise<void> {
  let lockAcquired = false;
  const temporaryFiles: string[] = [];
  try {
    console.log();
    logger.info(`Current version: v${VERSION}`);
    console.log();
    const platform = validatePlatform();
    validateInstallLayout();
    const installRoot = getInstallRoot();
    const currentRelease = getCurrentReleaseDirectory();
    acquireLock();
    lockAcquired = true;
    await cleanupObsoleteReleases(currentRelease);

    const releases = await filterCompatibleReleases(platform);
    const selection = await getUserSelection(formatReleaseMenu(releases));
    if (Number.isNaN(selection) || selection < 1 || selection > releases.length) {
      console.log("Invalid selection.");
      return;
    }
    const selected = releases[selection - 1];
    if (selected.version === VERSION) {
      logger.info(`Already on v${VERSION}`);
      return;
    }
    if (!(await checkWritePermissions())) throw new Error(`No write permission to ${installRoot}`);
    logger.info(`Selected: v${selected.version}`);

    const packageDownload = await downloadToTemp(selected.packageAsset.url, selected.packageAsset.name);
    const checksumDownload = await downloadToTemp(selected.checksumAsset.url, selected.checksumAsset.name);
    const signatureDownload = await downloadToTemp(selected.signatureAsset.url, selected.signatureAsset.name);
    temporaryFiles.push(packageDownload.filePath, checksumDownload.filePath, signatureDownload.filePath);
    if (!(await verifyManifestSignature(checksumDownload.filePath, signatureDownload.filePath))) {
      throw new Error("Release signature verification failed. The installed release was not changed.");
    }
    const checksumText = await Bun.file(checksumDownload.filePath).text();
    if (!(await verifyChecksum(packageDownload.filePath, checksumText, selected.packageAsset.name))) {
      throw new Error("Checksum verification failed. The installed release was not changed.");
    }
    const hash = await computeSHA256(packageDownload.filePath);
    const installed = await installReleaseArchive({
      archivePath: packageDownload.filePath,
      expectedVersion: selected.version,
      expectedTarget: platform,
      hashPrefix: hash.slice(0, 12),
    });

    if (installed.oldRelease && installed.oldRelease !== installed.newRelease) {
      try {
        await rm(installed.oldRelease, { recursive: true, force: true });
      } catch (error) {
        logger.warn(`Update succeeded, but the old release could not be removed: ${error}`);
      }
    }
    logger.info(`✓ Updated: v${VERSION} → v${selected.version}`);
    console.log(`\n✅ Updated successfully!\n   v${VERSION} → v${selected.version}\n   Current: ${installed.newRelease}\n`);
  } catch (error) {
    logger.error(`Update failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await Promise.all(temporaryFiles.map(cleanupTemp));
    if (lockAcquired) releaseLock();
  }
}

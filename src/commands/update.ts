import { existsSync, chmodSync, renameSync, copyFileSync, unlinkSync, readdirSync } from "fs";
import { basename, join, dirname } from "path";
import { logger } from "../utils/logger";
import { VERSION } from "../version";
import { validatePlatform } from "../utils/platform";
import {
  resolveInstalledBinary,
  getInstallDirectory,
  checkWritePermissions,
  validateInstallLayout,
} from "../utils/install";
import { filterCompatibleReleases, formatReleaseMenu } from "../utils/releases";
import { downloadToTemp, cleanupTemp } from "../utils/download";
import { verifyChecksum, verifyManifestSignature } from "../utils/checksum";
import { acquireLock, releaseLock } from "../utils/lock";

async function getUserSelection(prompt: string): Promise<number> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      const input = data.toString().trim();
      const num = parseInt(input, 10);
      resolve(num);
    });
  });
}

function backupCurrentBinary(binaryPath: string): string {
  const backupPath = join(
    dirname(binaryPath),
    `.${basename(binaryPath)}.backup-${Date.now()}.bak`,
  );
  copyFileSync(binaryPath, backupPath);
  logger.debug(`Backup created: ${backupPath}`);

  // Keep only latest 1 backup
  const dir = dirname(binaryPath);
  const backups = readdirSync(dir)
    .filter((f) => f.startsWith(`.${basename(binaryPath)}.backup-`) && f.endsWith(".bak"))
    .sort()
    .reverse();

  // Delete old backups (keep only latest)
  for (let i = 1; i < backups.length; i++) {
    try {
      unlinkSync(join(dir, backups[i]));
      logger.debug(`Deleted old backup: ${backups[i]}`);
    } catch {
      // ignore
    }
  }

  return backupPath;
}

export async function update(): Promise<void> {
  let lockAcquired = false;

  try {
    // Step 1: Load current version
    console.log();
    logger.info(`Current version: v${VERSION}`);
    console.log();

    // Step 2: Validate platform
    const platform = validatePlatform();
    logger.debug(`Platform: ${platform}`);

    // Step 3: Validate install layout
    validateInstallLayout();
    const binaryPath = resolveInstalledBinary();
    logger.debug(`Binary: ${binaryPath}`);

    // Step 4: Acquire lock
    acquireLock();
    lockAcquired = true;

    // Step 5: Fetch releases
    const releases = await filterCompatibleReleases(platform);

    if (releases.length === 0) {
      throw new Error("No compatible releases found.");
    }

    // Step 6: Show menu
    const menu = formatReleaseMenu(releases);
    const selection = await getUserSelection(menu);

    if (isNaN(selection) || selection < 1 || selection > releases.length) {
      console.log("Invalid selection.");
      return;
    }

    const selectedRelease = releases[selection - 1];

    // Step 7: Check if selected == current
    if (selectedRelease.version === VERSION) {
      logger.info(`Already on v${VERSION}`);
      return;
    }

    console.log();
    logger.info(`Selected: v${selectedRelease.version}`);

    // Step 8: Check permissions
    const hasPermission = await checkWritePermissions();
    if (!hasPermission) {
      logger.warn(`No write permission to ${getInstallDirectory()}`);
      console.log(`
The install directory is not writable. Reinstall to ~/.local/bin or fix its permissions.
      `);
      return;
    }

    // Step 9: Download binary
    let binaryResult: Awaited<ReturnType<typeof downloadToTemp>> | undefined;
    let checksumResult: Awaited<ReturnType<typeof downloadToTemp>> | undefined;
    let signatureResult: Awaited<ReturnType<typeof downloadToTemp>> | undefined;
    let checksumText: string;

    try {
      binaryResult = await downloadToTemp(
        selectedRelease.binaryAsset.url,
        selectedRelease.binaryAsset.name
      );

      checksumResult = await downloadToTemp(
        selectedRelease.checksumAsset.url,
        selectedRelease.checksumAsset.name
      );

      signatureResult = await downloadToTemp(
        selectedRelease.signatureAsset.url,
        selectedRelease.signatureAsset.name
      );

      // Read checksum text
      checksumText = await Bun.file(checksumResult.filePath).text();
    } catch (error) {
      if (binaryResult) {
        await cleanupTemp(binaryResult.filePath);
      }
      if (checksumResult) {
        await cleanupTemp(checksumResult.filePath);
      }
      if (signatureResult) {
        await cleanupTemp(signatureResult.filePath);
      }
      throw error;
    }

    // Step 10: Verify the signed manifest before trusting its checksum.
    const signatureValid = await verifyManifestSignature(
      checksumResult.filePath,
      signatureResult.filePath,
    );
    if (!signatureValid) {
      await cleanupTemp(binaryResult.filePath);
      await cleanupTemp(checksumResult.filePath);
      await cleanupTemp(signatureResult.filePath);
      throw new Error("Release signature verification failed. Binary was not replaced.");
    }

    const checksumValid = await verifyChecksum(
      binaryResult.filePath,
      checksumText,
      selectedRelease.binaryAsset.name
    );

    if (!checksumValid) {
      await cleanupTemp(binaryResult.filePath);
      await cleanupTemp(checksumResult.filePath);
      await cleanupTemp(signatureResult.filePath);
      throw new Error("Checksum verification failed. Binary may be corrupted.");
    }

    // Step 11: Backup current binary
    const backupPath = backupCurrentBinary(binaryPath);

    try {
      // Step 12: Make binary executable
      chmodSync(binaryResult.filePath, 0o755);

      // Step 13: Atomic replace (rename)
      renameSync(binaryResult.filePath, binaryPath);
      logger.info(`✓ Updated: v${VERSION} → v${selectedRelease.version}`);

      // Clean up checksum temp
      await cleanupTemp(checksumResult.filePath);
      await cleanupTemp(signatureResult.filePath);

      // Step 14: Show summary
      console.log();
      console.log(`✅ Updated successfully!`);
      console.log(`   v${VERSION} → v${selectedRelease.version}`);
      console.log(`   Location: ${binaryPath}`);
      console.log(`   Backup: ${backupPath}`);
      console.log();
      console.log(`⚠️  Restart your shell to use the new version:`);
      console.log(`   exec $SHELL`);
      console.log();
    } catch (error) {
      // Atomic replace failed - restore from backup
      logger.error(`Atomic replace failed: ${error}`);

      try {
        if (existsSync(backupPath)) {
          logger.warn("Restoring from backup...");
          copyFileSync(backupPath, binaryPath);
          logger.info("Restored from backup");
        }
      } catch (restoreError) {
        logger.error(`Failed to restore from backup: ${restoreError}`);
      }

      throw error;
    }
  } catch (error) {
    logger.error(
      `Update failed: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  } finally {
    if (lockAcquired) {
      releaseLock();
    }
  }
}

import { existsSync, statSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { logger } from "./logger";

export function resolveInstalledBinary(): string {
  const binaryPath = process.execPath;

  // Verify it's a regular file (not symlink)
  try {
    const stat = statSync(binaryPath);
    if (!stat.isFile()) {
      throw new Error(`Not a regular file: ${binaryPath}`);
    }
  } catch (error) {
    throw new Error(
      `Cannot read installed binary: ${error instanceof Error ? error.message : error}`
    );
  }

  // Verify directory is writable (we'll do detailed check in checkWritePermissions)
  const installDir = dirname(binaryPath);
  if (!existsSync(installDir)) {
    throw new Error(`Install directory does not exist: ${installDir}`);
  }

  return binaryPath;
}

export function getInstallDirectory(): string {
  const binaryPath = resolveInstalledBinary();
  return dirname(binaryPath);
}

export async function checkWritePermissions(): Promise<boolean> {
  const installDir = getInstallDirectory();

  // Attempt a temp file probe: create, write, rename (same dir), delete
  const tempFile = join(installDir, `.coupon-finder-permission-check-${Date.now()}.tmp`);

  try {
    // Create and write
    writeFileSync(tempFile, "test", "utf-8");

    // Try to rename (same directory - atomic on POSIX)
    const renamedFile = join(installDir, `.coupon-finder-permission-check-${Date.now()}-renamed.tmp`);
    const fs = await import("fs/promises");
    await fs.rename(tempFile, renamedFile);

    // Delete
    await fs.unlink(renamedFile);

    return true;
  } catch (error) {
    // Clean up any leftover temp files
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch {
      // ignore
    }

    logger.warn(
      `Write permission check failed: ${error instanceof Error ? error.message : error}`
    );
    return false;
  }
}

export function validateInstallLayout(): void {
  try {
    resolveInstalledBinary();
  } catch (error) {
    logger.error(
      `Unsupported install layout: ${error instanceof Error ? error.message : error}`
    );
    logger.error("Reinstall using: curl -fsSL github.com/minatorak/coupon-finder/install.sh | bash");
    process.exit(1);
  }
}

import { writeFileSync, existsSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { logger } from "./logger";
import { getInstallDirectory } from "./install";

interface LockFile {
  pid: number;
  timestamp: number;
}

interface LockOptions {
  lockPath?: string;
  isProcessRunning?: (pid: number) => boolean;
}

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getLockFilePath(): string {
  const installDir = getInstallDirectory();
  return join(installDir, ".coupon-finder-update.lock");
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but cannot be signalled by this user.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

export function acquireLock(options: LockOptions = {}): void {
  const lockPath = options.lockPath ?? getLockFilePath();
  const processIsRunning = options.isProcessRunning ?? isProcessRunning;

  // Check if lock already exists and is still valid
  if (existsSync(lockPath)) {
    try {
      const content = readFileSync(lockPath, "utf-8");
      const lockData: LockFile = JSON.parse(content);
      const age = Date.now() - lockData.timestamp;

      if (age < LOCK_TTL_MS && processIsRunning(lockData.pid)) {
        // Lock is still fresh
        throw new Error(
          `Update already in progress (PID ${lockData.pid}). Try again in a moment.`
        );
      }

      // The lock has expired or its owner process no longer exists.
      logger.debug("Stale lock detected, removing...");
      unlinkSync(lockPath);
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Corrupted lock file, remove it
        logger.warn("Corrupted lock file, removing...");
        try {
          unlinkSync(lockPath);
        } catch {
          // ignore
        }
      } else {
        // Re-throw actual lock errors
        throw error;
      }
    }
  }

  // Create new lock
  const lockData: LockFile = {
    pid: process.pid,
    timestamp: Date.now(),
  };

  try {
    writeFileSync(lockPath, JSON.stringify(lockData), "utf-8");
    logger.debug(`Lock acquired: ${lockPath}`);
  } catch (error) {
    throw new Error(
      `Failed to acquire lock: ${error instanceof Error ? error.message : error}`
    );
  }
}

export function releaseLock(options: Pick<LockOptions, "lockPath"> = {}): void {
  const lockPath = options.lockPath ?? getLockFilePath();

  try {
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
      logger.debug(`Lock released: ${lockPath}`);
    }
  } catch (error) {
    logger.warn(`Failed to release lock: ${error}`);
  }
}

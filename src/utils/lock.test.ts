import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { acquireLock, releaseLock } from "./lock";

const tempDirectories: string[] = [];

function createLockPath(): string {
  const directory = mkdtempSync(join(tmpdir(), "coupon-finder-lock-"));
  tempDirectories.push(directory);
  return join(directory, ".coupon-finder-update.lock");
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("update lock", () => {
  test("replaces a fresh lock when its owner process is gone", () => {
    const lockPath = createLockPath();
    writeFileSync(lockPath, JSON.stringify({ pid: 1777, timestamp: Date.now() }));

    acquireLock({ lockPath, isProcessRunning: () => false });

    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    expect(lock.pid).toBe(process.pid);
  });

  test("rejects a fresh lock while its owner process is alive", () => {
    const lockPath = createLockPath();
    writeFileSync(lockPath, JSON.stringify({ pid: 1777, timestamp: Date.now() }));

    expect(() =>
      acquireLock({ lockPath, isProcessRunning: () => true }),
    ).toThrow("Update already in progress (PID 1777)");
  });

  test("release removes the requested lock file", () => {
    const lockPath = createLockPath();
    writeFileSync(lockPath, "lock");

    releaseLock({ lockPath });

    expect(existsSync(lockPath)).toBe(false);
  });
});

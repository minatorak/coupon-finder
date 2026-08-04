import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, relative } from "path";
import {
  BrowserInstallDependencies,
  ensureManagedBrowser,
  ManagedBrowserExecutable,
} from "./browser-installer";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture(): {
  dependencies: BrowserInstallDependencies;
  executable: ManagedBrowserExecutable;
  downloads: string[];
} {
  const root = mkdtempSync(join(tmpdir(), "coupon-finder-installer-"));
  temporaryDirectories.push(root);
  const directory = join(root, "firefox-1");
  const executablePath = join(directory, "firefox", "firefox");
  const executable = {
    browserVersion: "1.0",
    directory,
    downloadURLs: ["https://invalid.test/firefox.zip"],
    executablePath,
    title: "Firefox",
  };
  const downloads: string[] = [];
  const dependencies: BrowserInstallDependencies = {
    resolve: () => executable,
    download: async (url, destination) => {
      downloads.push(url);
      writeFileSync(destination, "archive");
    },
    extract: async (_archivePath, destination) => {
      const stagedExecutable = join(
        destination,
        relative(directory, executablePath),
      );
      mkdirSync(dirname(stagedExecutable), { recursive: true });
      writeFileSync(stagedExecutable, "browser");
      chmodSync(stagedExecutable, 0o755);
    },
  };
  return { dependencies, executable, downloads };
}

describe("ensureManagedBrowser", () => {
  test("does not download an installed browser", async () => {
    const { dependencies, executable, downloads } = fixture();
    mkdirSync(dirname(executable.executablePath), { recursive: true });
    writeFileSync(executable.executablePath, "browser");
    chmodSync(executable.executablePath, 0o755);

    expect(await ensureManagedBrowser("firefox", dependencies)).toBe(
      executable.executablePath,
    );
    expect(downloads).toEqual([]);
  });

  test("downloads and installs a missing browser", async () => {
    const { dependencies, executable, downloads } = fixture();

    expect(await ensureManagedBrowser("firefox", dependencies)).toBe(
      executable.executablePath,
    );
    expect(downloads).toEqual(executable.downloadURLs);
    expect(existsSync(executable.executablePath)).toBe(true);
    expect(existsSync(join(executable.directory, "INSTALLATION_COMPLETE"))).toBe(
      true,
    );
  });

  test("shares one download between concurrent callers", async () => {
    const { dependencies, downloads } = fixture();

    await Promise.all([
      ensureManagedBrowser("firefox", dependencies),
      ensureManagedBrowser("firefox", dependencies),
    ]);

    expect(downloads).toHaveLength(1);
  });
});

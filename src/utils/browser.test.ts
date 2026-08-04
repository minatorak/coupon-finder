import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveBrowserLaunchTarget } from "./browser";

const temporaryDirectories: string[] = [];
const originalBrowserPath = process.env.COUPON_FINDER_BROWSER_PATH;

afterEach(() => {
  if (originalBrowserPath === undefined) {
    delete process.env.COUPON_FINDER_BROWSER_PATH;
  } else {
    process.env.COUPON_FINDER_BROWSER_PATH = originalBrowserPath;
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function executableOverride(): string {
  const directory = mkdtempSync(join(tmpdir(), "coupon-finder-browser-"));
  const executable = join(directory, "firefox");
  temporaryDirectories.push(directory);
  writeFileSync(executable, "");
  chmodSync(executable, 0o755);
  return executable;
}

describe("resolveBrowserLaunchTarget", () => {
  test("uses Playwright's bundled Firefox by default", () => {
    delete process.env.COUPON_FINDER_BROWSER_PATH;

    expect(resolveBrowserLaunchTarget("firefox")).toEqual({
      engine: "firefox",
      managedBrowser: "firefox",
    });
  });

  test("uses Playwright's bundled Chromium for Chrome by default", () => {
    delete process.env.COUPON_FINDER_BROWSER_PATH;

    expect(resolveBrowserLaunchTarget("chrome")).toEqual({
      engine: "chromium",
      managedBrowser: "chromium",
    });
  });

  test("honors an explicit compatible Firefox override", () => {
    const executablePath = executableOverride();
    process.env.COUPON_FINDER_BROWSER_PATH = executablePath;

    expect(resolveBrowserLaunchTarget("firefox")).toEqual({
      engine: "firefox",
      executablePath,
    });
  });
});

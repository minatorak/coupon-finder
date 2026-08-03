import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { findSessionDatabase } from "./session";

const temporaryHomes: string[] = [];

afterEach(() => {
  delete process.env.COUPON_FINDER_HOME;
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

function temporaryHome(): string {
  const home = mkdtempSync(join(tmpdir(), "coupon-finder-home-"));
  temporaryHomes.push(home);
  process.env.COUPON_FINDER_HOME = home;
  return home;
}

function createCookieDatabase(path: string): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "placeholder");
  return path;
}

describe("findSessionDatabase", () => {
  test("finds Firefox cookies in the platform home", () => {
    const home = temporaryHome();
    const root = process.platform === "darwin"
      ? "Library/Application Support/Firefox/Profiles"
      : ".mozilla/firefox";
    const expected = createCookieDatabase(
      join(home, root, "default-release", "cookies.sqlite"),
    );

    expect(findSessionDatabase("firefox")).toBe(expected);
  });

  test("finds Chrome and Brave cookie databases on desktop platforms", () => {
    const home = temporaryHome();
    const chromeRoot = process.platform === "darwin"
      ? "Library/Application Support/Google/Chrome"
      : ".config/google-chrome";
    const braveRoot = process.platform === "darwin"
      ? "Library/Application Support/BraveSoftware/Brave-Browser"
      : ".config/BraveSoftware/Brave-Browser";
    const chromePath = createCookieDatabase(join(home, chromeRoot, "Default/Cookies"));
    const bravePath = createCookieDatabase(join(home, braveRoot, "Default/Cookies"));

    expect(findSessionDatabase("chrome")).toBe(chromePath);
    expect(findSessionDatabase("brave")).toBe(bravePath);
  });
});

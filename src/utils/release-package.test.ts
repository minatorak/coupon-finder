import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createLauncherScript,
  parseReleaseMetadata,
  validateReleaseMetadata,
  validateTarEntries,
} from "./release-package";
import { validateArchiveSymlink } from "./install";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("launcher replaces ambient dependency paths with installed paths", async () => {
  const home = mkdtempSync(join(tmpdir(), "coupon-finder-launcher-"));
  temporaryDirectories.push(home);
  const root = join(home, ".local/share/coupon-finder");
  mkdirSync(join(root, "current/bin"), { recursive: true });
  const runtime = join(root, "current/bin/coupon-finder-runtime");
  writeFileSync(runtime, '#!/usr/bin/env bash\nprintf "%s\\n%s\\n%s\\n" "$COUPON_FINDER_INSTALL_ROOT" "$NODE_PATH" "$PLAYWRIGHT_BROWSERS_PATH"\n');
  chmodSync(runtime, 0o755);
  const launcher = join(home, "coupon-finder");
  writeFileSync(launcher, createLauncherScript());
  chmodSync(launcher, 0o755);
  const child = Bun.spawn([launcher], { env: { ...process.env, HOME: home, NODE_PATH: "/ambient/modules" }, stdout: "pipe" });
  expect(await new Response(child.stdout).text()).toBe(`${root}\n${root}/current/lib/node_modules\n${root}/browsers\n`);
  expect(await child.exited).toBe(0);
});

describe("release metadata", () => {
  test("parses the fixed metadata contract", () => {
    expect(parseReleaseMetadata("format=1\nversion=0.2.1\ntarget=darwin-x64\n")).toEqual({
      format: "1",
      version: "0.2.1",
      target: "darwin-x64",
    });
  });

  test("rejects malformed, version, and target mismatches", () => {
    expect(() => parseReleaseMetadata("format=1\nversion=nope\ntarget=linux-x64\n")).toThrow();
    const metadata = parseReleaseMetadata("format=1\nversion=0.2.1\ntarget=linux-x64\n");
    expect(() => validateReleaseMetadata(metadata, "0.2.2", "linux-x64")).toThrow("version mismatch");
    expect(() => validateReleaseMetadata(metadata, "0.2.1", "darwin-x64")).toThrow("target mismatch");
  });
});

describe("archive paths", () => {
  test("accepts only entries below the package root", () => {
    expect(() => validateTarEntries([
      "coupon-finder/",
      "coupon-finder/RELEASE",
      "coupon-finder/bin/coupon-finder-runtime",
    ])).not.toThrow();
  });

  test.each(["/tmp/evil", "other/file", "coupon-finder/../evil", "coupon-finder\\evil"])(
    "rejects unsafe entry %s",
    (entry) => expect(() => validateTarEntries([entry])).toThrow("Unsafe archive entry"),
  );

  test("rejects symlinks that escape the package root", () => {
    expect(() => validateArchiveSymlink("coupon-finder/bin/tool", "../runtime")).not.toThrow();
    expect(() => validateArchiveSymlink("coupon-finder/bin/tool", "../../outside")).toThrow("Unsafe archive symlink");
    expect(() => validateArchiveSymlink("coupon-finder/bin/tool", "/tmp/outside")).toThrow("Unsafe archive symlink");
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readlinkSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { installReleaseArchive } from "./install";

const temporary: string[] = [];
const previousRoot = process.env.COUPON_FINDER_INSTALL_ROOT;

function archive(version: string, target: string, postSwitchFailure = false): string {
  const directory = mkdtempSync(join(tmpdir(), "coupon-finder-package-"));
  temporary.push(directory);
  const root = join(directory, "coupon-finder");
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "lib/node_modules/playwright"), { recursive: true });
  mkdirSync(join(root, "lib/node_modules/playwright-core/lib"), { recursive: true });
  writeFileSync(join(root, "RELEASE"), `format=1\nversion=${version}\ntarget=${target}\n`);
  const runtime = join(root, "bin/coupon-finder-runtime");
  writeFileSync(runtime, postSwitchFailure
    ? '#!/usr/bin/env bash\ncase "$0" in */releases/*) exit 17;; esac\nexit 0\n'
    : "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(runtime, 0o755);
  writeFileSync(join(root, "bin/coupon-finder"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(join(root, "bin/coupon-finder"), 0o755);
  writeFileSync(join(root, "lib/node_modules/playwright/package.json"), "{}");
  writeFileSync(join(root, "lib/node_modules/playwright-core/package.json"), "{}");
  writeFileSync(join(root, "lib/node_modules/playwright-core/browsers.json"), "{}");
  writeFileSync(join(root, "lib/node_modules/playwright-core/lib/coreBundle.js"), "");
  const result = Bun.spawnSync(["tar", "-czf", join(directory, "release.tar.gz"), "coupon-finder"], { cwd: directory });
  if (!result.success) throw new Error("tar failed");
  return join(directory, "release.tar.gz");
}

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
  if (previousRoot === undefined) delete process.env.COUPON_FINDER_INSTALL_ROOT;
  else process.env.COUPON_FINDER_INSTALL_ROOT = previousRoot;
});

describe("immutable release transaction", () => {
  test("switches versions and reports the old release", async () => {
    const root = mkdtempSync(join(tmpdir(), "coupon-finder-root-"));
    temporary.push(root);
    process.env.COUPON_FINDER_INSTALL_ROOT = root;
    const target = process.platform === "darwin" ? `darwin-${process.arch}` : `linux-${process.arch}`;
    const first = await installReleaseArchive({ archivePath: archive("1.0.0", target), expectedVersion: "1.0.0", expectedTarget: target, hashPrefix: "aaaaaaaaaaaa" });
    const second = await installReleaseArchive({ archivePath: archive("2.0.0", target), expectedVersion: "2.0.0", expectedTarget: target, hashPrefix: "bbbbbbbbbbbb" });
    expect(second.oldRelease).toBe(first.newRelease);
    expect(readlinkSync(join(root, "current"))).toContain("2.0.0");
  });

  test("restores current when post-switch smoke fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "coupon-finder-root-"));
    temporary.push(root);
    process.env.COUPON_FINDER_INSTALL_ROOT = root;
    const target = process.platform === "darwin" ? `darwin-${process.arch}` : `linux-${process.arch}`;
    const first = await installReleaseArchive({ archivePath: archive("1.0.0", target), expectedVersion: "1.0.0", expectedTarget: target, hashPrefix: "aaaaaaaaaaaa" });
    await expect(installReleaseArchive({ archivePath: archive("2.0.0", target, true), expectedVersion: "2.0.0", expectedTarget: target, hashPrefix: "bbbbbbbbbbbb" })).rejects.toThrow("smoke test failed");
    expect(readlinkSync(join(root, "current"))).toContain("1.0.0");
    expect(existsSync(first.newRelease)).toBe(true);
    expect(existsSync(join(root, "releases/2.0.0-" + target + "-bbbbbbbbbbbb"))).toBe(false);
  });
});

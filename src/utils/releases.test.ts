import { describe, expect, test } from "bun:test";
import { selectCompatibleReleases, type GitHubRelease } from "./releases";

function release(names: string[]): GitHubRelease {
  return {
    tag_name: "v0.2.1",
    draft: false,
    prerelease: false,
    published_at: "2026-08-04T00:00:00Z",
    assets: names.map((name) => ({ name, browser_download_url: `https://example.test/${name}`, size: 42 })),
  };
}

describe("release archive discovery", () => {
  test("selects the matching archive and trust assets", () => {
    const selected = selectCompatibleReleases([
      release(["coupon-finder-darwin-x64.tar.gz", "checksums.txt", "checksums.txt.sig"]),
    ], "darwin-x64");
    expect(selected).toHaveLength(1);
    expect(selected[0].packageAsset.name).toBe("coupon-finder-darwin-x64.tar.gz");
  });

  test("rejects legacy raw binaries and another target", () => {
    expect(() => selectCompatibleReleases([
      release(["coupon-finder-darwin-x64", "checksums.txt", "checksums.txt.sig"]),
      release(["coupon-finder-linux-x64.tar.gz", "checksums.txt", "checksums.txt.sig"]),
    ], "darwin-x64")).toThrow("No compatible releases");
  });
});

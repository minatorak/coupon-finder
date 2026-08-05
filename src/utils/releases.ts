import { logger } from "./logger";
import { SupportedPlatform } from "./platform";

export interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
  published_at: string;
}

export interface ReleaseWithAssets {
  version: string;
  tagName: string;
  packageAsset: {
    name: string;
    url: string;
    size: number;
  };
  checksumAsset: {
    name: string;
    url: string;
  };
  signatureAsset: {
    name: string;
    url: string;
  };
  publishedAt: string;
}

const GITHUB_API = "https://api.github.com/repos/minatorak/coupon-finder";
const INCLUDE_PRERELEASE = false;

async function fetchReleasesPage(page: number): Promise<GitHubRelease[]> {
  const url = `${GITHUB_API}/releases?page=${page}&per_page=100`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "coupon-finder-cli",
        "Accept": "application/vnd.github.v3+json",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data as GitHubRelease[];
  } catch (error) {
    throw new Error(
      `Failed to fetch releases: ${error instanceof Error ? error.message : error}`
    );
  }
}

export async function fetchAllReleases(): Promise<GitHubRelease[]> {
  const allReleases: GitHubRelease[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const pageReleases = await fetchReleasesPage(page);
      if (pageReleases.length === 0) {
        hasMore = false;
        break;
      }

      allReleases.push(...pageReleases);
      page++;
    } catch (error) {
      logger.warn(`Error fetching page ${page}: ${error}`);
      // If we got some releases, continue with what we have
      if (allReleases.length > 0) {
        hasMore = false;
      } else {
        throw error;
      }
    }
  }

  return allReleases;
}

function parseVersion(tagName: string): number[] {
  const match = tagName.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

export async function filterCompatibleReleases(
  platform: SupportedPlatform
): Promise<ReleaseWithAssets[]> {
  logger.info("Fetching releases from GitHub...");

  const releases = await fetchAllReleases();

  // Filter: exclude drafts, optionally exclude prerelease
  const filtered = releases.filter((r) => {
    if (r.draft) return false;
    if (!INCLUDE_PRERELEASE && r.prerelease) return false;
    return true;
  });

  if (filtered.length === 0) {
    throw new Error(
      "No stable releases found. Install from source or enable prerelease versions."
    );
  }

  return selectCompatibleReleases(filtered, platform);
}

export function selectCompatibleReleases(
  filtered: GitHubRelease[],
  platform: SupportedPlatform,
): ReleaseWithAssets[] {
  // Find compatible archive assets. Legacy raw binaries are intentionally ignored.
  const compatible: ReleaseWithAssets[] = [];

  for (const release of filtered) {
    const packageName = `coupon-finder-${platform}.tar.gz`;
    const checksumName = "checksums.txt";
    const signatureName = "checksums.txt.sig";

    const packageAsset = release.assets.find((a) => a.name === packageName);
    const checksumAsset = release.assets.find((a) => a.name === checksumName);
    const signatureAsset = release.assets.find((a) => a.name === signatureName);

    if (packageAsset && checksumAsset && signatureAsset) {
      compatible.push({
        version: release.tag_name.replace(/^v/, ""),
        tagName: release.tag_name,
        packageAsset: {
          name: packageAsset.name,
          url: packageAsset.browser_download_url,
          size: packageAsset.size,
        },
        checksumAsset: {
          name: checksumAsset.name,
          url: checksumAsset.browser_download_url,
        },
        signatureAsset: {
          name: signatureAsset.name,
          url: signatureAsset.browser_download_url,
        },
        publishedAt: release.published_at,
      });
    }
  }

  if (compatible.length === 0) {
    throw new Error(
      `No compatible releases found for ${platform}. Ensure the signed release assets are present.`
    );
  }

  // Sort by semver descending (newest first)
  compatible.sort((a, b) => {
    const aVer = parseVersion(a.version);
    const bVer = parseVersion(b.version);
    return compareVersions(bVer, aVer); // descending (b - a)
  });

  return compatible;
}

export function formatReleaseMenu(releases: ReleaseWithAssets[]): string {
  let menu = "\n📦 Available Versions:\n\n";

  releases.forEach((r, i) => {
    const size = (r.packageAsset.size / 1024 / 1024).toFixed(1);
    const date = new Date(r.publishedAt).toLocaleDateString();
    menu += `  [${i + 1}] v${r.version}  (${size}MB, ${date})\n`;
  });

  menu += `\nEnter number to select (1-${releases.length}): `;
  return menu;
}

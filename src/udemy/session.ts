import { homedir, tmpdir } from "os";
import { join } from "path";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { Database } from "bun:sqlite";
import { logger } from "../utils/logger";

export interface UdemyCookies {
  authToken: string;
  csrfToken: string;
}

type SupportedBrowser = "firefox" | "chrome" | "brave";

function userHome(): string {
  return process.env.COUPON_FINDER_HOME ?? homedir();
}

function firefoxProfileDirectories(): string[] {
  if (process.platform === "darwin") {
    return [join(userHome(), "Library/Application Support/Firefox/Profiles")];
  }
  if (process.platform === "linux") {
    return [join(userHome(), ".mozilla/firefox")];
  }
  return [];
}

function findFirefoxProfileWithCookies(): string | null {
  for (const firefoxDir of firefoxProfileDirectories()) {
    if (!existsSync(firefoxDir)) continue;

    try {
      const profiles = readdirSync(firefoxDir);
      for (const profile of profiles) {
        if (profile.includes("default-release")) {
          const cookiePath = join(firefoxDir, profile, "cookies.sqlite");
          if (existsSync(cookiePath)) return cookiePath;
        }
      }
      for (const profile of profiles) {
        const cookiePath = join(firefoxDir, profile, "cookies.sqlite");
        if (existsSync(cookiePath)) return cookiePath;
      }
    } catch {
      // Try the next supported location.
    }
  }
  return null;
}

function chromiumCookieDatabasePaths(browser: "chrome" | "brave"): string[] {
  if (process.platform === "darwin") {
    const root = browser === "chrome"
      ? "Library/Application Support/Google/Chrome"
      : "Library/Application Support/BraveSoftware/Brave-Browser";
    return [join(userHome(), root, "Default/Cookies")];
  }

  if (process.platform === "linux") {
    const roots = browser === "chrome"
      ? [
          ".config/google-chrome",
          ".config/google-chrome-for-testing",
          ".config/chromium",
        ]
      : [".config/BraveSoftware/Brave-Browser"];
    return roots.map((root) => join(userHome(), root, "Default/Cookies"));
  }

  return [];
}

export function findSessionDatabase(browser: SupportedBrowser): string | null {
  if (browser === "firefox") return findFirefoxProfileWithCookies();
  return chromiumCookieDatabasePaths(browser).find(existsSync) ?? null;
}

function copyDatabaseToTemp(sourcePath: string, browser: SupportedBrowser): string {
  const tempPath = join(tmpdir(), `coupon-finder-${browser}-cookies-${Date.now()}.sqlite`);
  copyFileSync(sourcePath, tempPath);
  return tempPath;
}

function readCookiesFromDatabase(
  sourcePath: string,
  browser: SupportedBrowser,
  query: string,
): UdemyCookies {
  const tempPath = copyDatabaseToTemp(sourcePath, browser);
  try {
    const db = new Database(tempPath);
    const cookies: UdemyCookies = { authToken: "", csrfToken: "" };
    const rows = db.query(query).all() as Array<{ name: string; value: string }>;

    for (const row of rows) {
      if (row.name === "access_token") {
        cookies.authToken = row.value.replace(/^"(.*)"$/, "$1");
      }
      if (row.name === "csrftoken") {
        cookies.csrfToken = row.value.replace(/^"(.*)"$/, "$1");
      }
    }

    db.close();
    if (!cookies.authToken) {
      throw new Error(`No Udemy auth token found in ${browser} cookies`);
    }
    return cookies;
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temp file may already have been removed after a failed copy.
    }
  }
}

async function readFirefoxCookies(): Promise<UdemyCookies> {
  try {
    const cookieDbPath = findSessionDatabase("firefox");
    if (!cookieDbPath) {
      throw new Error("Firefox cookies not found. Log in to Udemy in Firefox first.");
    }
    return readCookiesFromDatabase(
      cookieDbPath,
      "firefox",
      "SELECT name, value FROM moz_cookies WHERE host LIKE '%udemy.com%'",
    );
  } catch (error) {
    logger.error(`Failed to read Firefox cookies: ${error}`);
    throw error;
  }
}

async function readChromiumCookies(browser: "chrome" | "brave"): Promise<UdemyCookies> {
  try {
    const cookieDbPath = findSessionDatabase(browser);
    if (!cookieDbPath) {
      throw new Error(`${browser} cookies not found. Log in to Udemy first.`);
    }
    return readCookiesFromDatabase(
      cookieDbPath,
      browser,
      "SELECT name, value FROM cookies WHERE host_key LIKE '%udemy.com%'",
    );
  } catch (error) {
    logger.error(`Failed to read ${browser} cookies: ${error}`);
    throw error;
  }
}

export async function readSessionCookies(
  browser: SupportedBrowser,
): Promise<UdemyCookies> {
  logger.debug(`Reading ${browser} session cookies...`);

  switch (browser) {
    case "firefox":
      return readFirefoxCookies();
    case "chrome":
    case "brave":
      return readChromiumCookies(browser);
    default:
      throw new Error(`Unsupported browser: ${browser}`);
  }
}

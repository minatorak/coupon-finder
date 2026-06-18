import { homedir } from "os";
import { join } from "path";
import { copyFileSync, readFileSync, unlinkSync, existsSync, readdirSync } from "fs";
import { Database } from "bun:sqlite";
import { logger } from "../utils/logger";

export interface UdemyCookies {
  authToken: string;
  csrfToken: string;
}

function findFirefoxProfileWithCookies(): string | null {
  const firefoxDir = join(
    homedir(),
    "Library/Application Support/Firefox/Profiles"
  );

  if (!existsSync(firefoxDir)) {
    return null;
  }

  try {
    const profiles = readdirSync(firefoxDir);

    // Prefer default-release
    for (const profile of profiles) {
      if (profile.includes("default-release")) {
        const cookiePath = join(firefoxDir, profile, "cookies.sqlite");
        if (existsSync(cookiePath)) {
          return cookiePath;
        }
      }
    }

    // Fallback: first profile with cookies.sqlite
    for (const profile of profiles) {
      const cookiePath = join(firefoxDir, profile, "cookies.sqlite");
      if (existsSync(cookiePath)) {
        return cookiePath;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function readFirefoxCookies(): Promise<UdemyCookies> {
  try {
    const cookieDbPath = findFirefoxProfileWithCookies();
    if (!cookieDbPath) {
      throw new Error("Firefox cookies not found. Log in to Udemy in Firefox first.");
    }

    // Copy to temp file (Firefox may lock it)
    const tempPath = `/tmp/firefox_cookies_${Date.now()}.sqlite`;
    copyFileSync(cookieDbPath, tempPath);

    try {
      const db = new Database(tempPath);
      const cookies: UdemyCookies = {
        authToken: "",
        csrfToken: "",
      };

      const rows = db.query(
        "SELECT name, value FROM moz_cookies WHERE host LIKE '%udemy.com%'"
      ).all() as any[];

      for (const row of rows) {
        if (row.name === "access_token") cookies.authToken = row.value.replace(/^"(.*)"$/, "$1");
        if (row.name === "csrftoken") cookies.csrfToken = row.value.replace(/^"(.*)"$/, "$1");
      }

      db.close();

      if (!cookies.authToken) {
        throw new Error("No Udemy auth token found in Firefox cookies");
      }

      return cookies;
    } finally {
      unlinkSync(tempPath);
    }
  } catch (error) {
    logger.error(`Failed to read Firefox cookies: ${error}`);
    throw error;
  }
}

async function readChromeCookies(): Promise<UdemyCookies> {
  const chromeDir = join(
    homedir(),
    "Library/Application Support/Google/Chrome/Default"
  );

  try {
    const cookieDbPath = join(chromeDir, "Cookies");
    const tempPath = `/tmp/chrome_cookies_${Date.now()}.sqlite`;
    copyFileSync(cookieDbPath, tempPath);

    try {
      const db = new Database(tempPath);
      const cookies: UdemyCookies = {
        authToken: "",
        csrfToken: "",
      };

      const rows = db.query(
        "SELECT name, value FROM cookies WHERE host_key LIKE '%udemy.com%'"
      ).all() as any[];

      for (const row of rows) {
        if (row.name === "access_token") cookies.authToken = row.value.replace(/^"(.*)"$/, "$1");
        if (row.name === "csrftoken") cookies.csrfToken = row.value.replace(/^"(.*)"$/, "$1");
      }

      db.close();

      if (!cookies.authToken) {
        throw new Error("No Udemy auth token found in Chrome cookies");
      }

      return cookies;
    } finally {
      unlinkSync(tempPath);
    }
  } catch (error) {
    logger.error(`Failed to read Chrome cookies: ${error}`);
    throw error;
  }
}

async function readBraveCookies(): Promise<UdemyCookies> {
  const braveDir = join(
    homedir(),
    "Library/Application Support/BraveSoftware/Brave-Browser/Default"
  );

  try {
    const cookieDbPath = join(braveDir, "Cookies");
    const tempPath = `/tmp/brave_cookies_${Date.now()}.sqlite`;
    copyFileSync(cookieDbPath, tempPath);

    try {
      const db = new Database(tempPath);
      const cookies: UdemyCookies = {
        authToken: "",
        csrfToken: "",
      };

      const rows = db.query(
        "SELECT name, value FROM cookies WHERE host_key LIKE '%udemy.com%'"
      ).all() as any[];

      for (const row of rows) {
        if (row.name === "access_token") cookies.authToken = row.value.replace(/^"(.*)"$/, "$1");
        if (row.name === "csrftoken") cookies.csrfToken = row.value.replace(/^"(.*)"$/, "$1");
      }

      db.close();

      if (!cookies.authToken) {
        throw new Error("No Udemy auth token found in Brave cookies");
      }

      return cookies;
    } finally {
      unlinkSync(tempPath);
    }
  } catch (error) {
    logger.error(`Failed to read Brave cookies: ${error}`);
    throw error;
  }
}

export async function readSessionCookies(
  browser: "firefox" | "chrome" | "brave"
): Promise<UdemyCookies> {
  logger.debug(`Reading ${browser} session cookies...`);

  switch (browser) {
    case "firefox":
      return readFirefoxCookies();
    case "chrome":
      return readChromeCookies();
    case "brave":
      return readBraveCookies();
    default:
      throw new Error(`Unsupported browser: ${browser}`);
  }
}

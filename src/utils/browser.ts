import { accessSync, constants, existsSync } from "fs";
import { homedir } from "os";
import { delimiter, join } from "path";
import { Browser, chromium, firefox } from "playwright";
import { BrowserType } from "../types";
import {
  ensureManagedBrowser,
  ManagedBrowser,
} from "./browser-installer";
import { logger } from "./logger";

type SystemBrowser = Exclude<BrowserType, "chromium">;

export interface BrowserLaunchTarget {
  engine: "firefox" | "chromium";
  executablePath?: string;
  managedBrowser?: ManagedBrowser;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function executableFromPath(command: string): string | undefined {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, command);
    if (isExecutable(candidate)) return candidate;
  }
  return undefined;
}

function platformCandidates(browser: SystemBrowser): string[] {
  const home = homedir();

  if (process.platform === "darwin") {
    const application = {
      firefox: "Firefox.app/Contents/MacOS/firefox",
      chrome: "Google Chrome.app/Contents/MacOS/Google Chrome",
      brave: "Brave Browser.app/Contents/MacOS/Brave Browser",
    }[browser];

    const candidates = [
      join("/Applications", application),
      join(home, "Applications", application),
    ];

    if (browser === "chrome") {
      candidates.push(
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      );
    }
    return candidates;
  }

  if (process.platform === "linux") {
    const commands = {
      firefox: ["firefox"],
      chrome: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
      brave: ["brave-browser", "brave"],
    }[browser];
    return commands
      .map(executableFromPath)
      .filter((candidate): candidate is string => candidate !== undefined);
  }

  return [];
}

export function findBrowserExecutable(browser: BrowserType): string {
  const systemBrowser = browser === "chromium" ? "chrome" : browser;
  const override = process.env.COUPON_FINDER_BROWSER_PATH;
  const candidates = [
    ...(override ? [override] : []),
    ...platformCandidates(systemBrowser),
  ];
  const executablePath = candidates.find(
    (candidate) => existsSync(candidate) && isExecutable(candidate),
  );

  if (executablePath) return executablePath;

  const names = {
    firefox: "Firefox",
    chrome: "Google Chrome or Chromium",
    brave: "Brave",
  };
  throw new Error(
    `No ${names[systemBrowser]} executable was found. Install ${names[systemBrowser]}, log in to Udemy, and retry (or set COUPON_FINDER_BROWSER_PATH).`,
  );
}

export function resolveBrowserLaunchTarget(
  browserType: BrowserType,
): BrowserLaunchTarget {
  const engine = browserType === "firefox" ? "firefox" : "chromium";
  const override = process.env.COUPON_FINDER_BROWSER_PATH;

  if (!override && browserType === "firefox") {
    return { engine, managedBrowser: "firefox" };
  }
  if (!override && (browserType === "chrome" || browserType === "chromium")) {
    return { engine, managedBrowser: "chromium" };
  }

  return {
    engine,
    executablePath: findBrowserExecutable(browserType),
  };
}

export async function setupBrowser(
  headless = true,
  browserType: BrowserType = "firefox",
): Promise<Browser> {
  const target = resolveBrowserLaunchTarget(browserType);
  const executablePath = target.managedBrowser
    ? await ensureManagedBrowser(target.managedBrowser)
    : target.executablePath;
  logger.debug(
    `Setting up ${browserType} at ${executablePath} (headless: ${headless})`,
  );

  const launchOptions = {
    headless,
    executablePath,
    args: target.engine === "firefox" ? [] : ["--disable-images"],
  };

  return target.engine === "firefox"
    ? firefox.launch(launchOptions)
    : chromium.launch(launchOptions);
}

export function mapBrowserConfig(
  browser: "firefox" | "chrome" | "brave",
): "firefox" | "chromium" {
  return browser === "firefox" ? "firefox" : "chromium";
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

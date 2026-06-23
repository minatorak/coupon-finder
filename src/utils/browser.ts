import { Browser, chromium, firefox } from "playwright";
import { logger } from "./logger";

export async function setupBrowser(
  headless = true,
  browserType: "firefox" | "chromium" = "firefox"
): Promise<Browser> {
  logger.debug(`Setting up ${browserType} browser (headless: ${headless})`);

  const launchOptions = {
    headless,
    args: browserType === "chromium" ? ["--disable-images"] : [],
  };

  if (browserType === "firefox") {
    return firefox.launch(launchOptions);
  } else {
    return chromium.launch(launchOptions);
  }
}

export function mapBrowserConfig(browser: "firefox" | "chrome" | "brave"): "firefox" | "chromium" {
  return browser === "firefox" ? "firefox" : "chromium";
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

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

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

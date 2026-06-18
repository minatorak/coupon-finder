import { BrowserPlugin } from "../../types";
import { readSessionCookies } from "../../udemy/session";
import { logger } from "../../utils/logger";

export class ChromePlugin implements BrowserPlugin {
  name = "chrome" as const;

  async init(): Promise<void> {
    logger.debug("Chrome plugin initialized");
  }

  async findCookies(): Promise<string> {
    const cookies = await readSessionCookies("chrome");
    return cookies.authToken;
  }

  async findSessionFile(): Promise<string> {
    return "~/Library/Application Support/Google/Chrome";
  }
}

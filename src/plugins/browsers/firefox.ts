import { BrowserPlugin } from "../../types";
import { readSessionCookies } from "../../udemy/session";
import { logger } from "../../utils/logger";

export class FirefoxPlugin implements BrowserPlugin {
  name = "firefox" as const;

  async init(): Promise<void> {
    logger.debug("Firefox plugin initialized");
  }

  async findCookies(): Promise<string> {
    const cookies = await readSessionCookies("firefox");
    return cookies.authToken;
  }

  async findSessionFile(): Promise<string> {
    return "~/.mozilla/firefox";
  }
}

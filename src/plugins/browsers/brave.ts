import { BrowserPlugin } from "../../types";
import { readSessionCookies } from "../../udemy/session";
import { logger } from "../../utils/logger";

export class BravePlugin implements BrowserPlugin {
  name = "brave" as const;

  async init(): Promise<void> {
    logger.debug("Brave plugin initialized");
  }

  async findCookies(): Promise<string> {
    const cookies = await readSessionCookies("brave");
    return cookies.authToken;
  }

  async findSessionFile(): Promise<string> {
    return "~/Library/Application Support/BraveSoftware/Brave-Browser";
  }
}

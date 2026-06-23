import { createUdemyAPI } from "../udemy/api";
import { readSessionCookies } from "../udemy/session";
import { loadConfig } from "../config";
import { logger } from "../utils/logger";

export async function whoami(): Promise<void> {
  let browserName = "Firefox";

  try {
    logger.info("Checking your Udemy login...");

    const config = await loadConfig();
    browserName = config.browser.charAt(0).toUpperCase() + config.browser.slice(1);
    const cookies = await readSessionCookies(config.browser);
    const api = await createUdemyAPI(cookies.authToken);
    const user = await api.getMe();

    console.log(`
✅ Logged in as: ${user.name}
${user.email ? `📧 Email: ${user.email}` : ""}
🌐 Browser: ${browserName}
✓ Session: valid

Ready to find and claim courses!
    `);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to check login: ${errorMsg}`);

    console.log(`
❌ Not logged in to Udemy

Make sure you are logged in to Udemy in ${browserName}:
  1. Open ${browserName}
  2. Visit: https://www.udemy.com
  3. Log in with your Udemy account
  4. Keep ${browserName} open, then try again:
     coupon-finder whoami

To use a different browser, run:
  coupon-finder config --set browser=chrome
  coupon-finder config --set browser=brave
  coupon-finder config --set browser=firefox

Error details: ${errorMsg}
    `);
    process.exit(1);
  }
}

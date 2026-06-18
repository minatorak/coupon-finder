import { ScraperPlugin, Course } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";

export class DiscudemyScraper implements ScraperPlugin {
  name = "discudemy" as const;

  async scrape(pages: number): Promise<Course[]> {
    const browser = await setupBrowser();
    const courses: Course[] = [];

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          await retryWithTimeout(async () => {
            logger.debug(`Scraping discudemy page ${pageNum}...`);

            const url = `https://www.discudemy.com/all/${pageNum}`;
            await page.goto(url, { waitUntil: "networkidle" });

            const courseElements = await page.locator(".course").all();

            for (const el of courseElements) {
              try {
                // Skip giveaway cards
                const isGiveaway = await el
                  .locator(".giveaway-badge")
                  .isVisible()
                  .catch(() => false);
                if (isGiveaway) continue;

                const title = await el.locator(".title").textContent();
                const link = await el.locator("a").getAttribute("href");
                const price = await el.locator(".price").textContent();

                if (title && link) {
                  // Follow couponami.com redirect to get real Udemy URL
                  const courseUrl = await this.resolveUrl(link.trim());

                  courses.push({
                    url: courseUrl,
                    title: title.trim(),
                    couponCodes: [],
                    discount: price === "FREE" ? 100 : undefined,
                    source: "discudemy",
                    scrapedAt: new Date(),
                  });
                }
              } catch (error) {
                logger.debug(`Failed to scrape course element: ${error}`);
              }
            }

            logger.info(`discudemy page ${pageNum}: ${courseElements.length} courses`);
          });
        } catch (error) {
          logger.warn(`Failed to scrape page ${pageNum}: ${error}`);
        }
      }

      await context.close();
    } finally {
      await closeBrowser(browser);
    }

    return courses;
  }

  private async resolveUrl(couponamiUrl: string): Promise<string> {
    // For now, return as-is; Phase 5 can implement full resolution if needed
    return couponamiUrl;
  }
}

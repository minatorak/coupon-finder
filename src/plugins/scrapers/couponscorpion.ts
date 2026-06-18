import { ScraperPlugin, Course } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";

export class CouponscorpionScraper implements ScraperPlugin {
  name = "couponscorpion" as const;

  async scrape(pages: number): Promise<Course[]> {
    const browser = await setupBrowser();
    const courses: Course[] = [];

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          await retryWithTimeout(async () => {
            logger.debug(`Scraping couponscorpion page ${pageNum}...`);

            const url = `https://www.couponscorpion.com/category/free-udemy-courses/page/${pageNum}/`;
            await page.goto(url, { waitUntil: "networkidle" });

            const courseElements = await page.locator(".course-item").all();

            for (const el of courseElements) {
              try {
                const title = await el.locator(".course-title").textContent();
                const link = await el.locator("a").getAttribute("href");
                const discount = await el
                  .locator(".discount")
                  .textContent();

                if (title && link) {
                  courses.push({
                    url: link.trim(),
                    title: title.trim(),
                    couponCodes: [],
                    discount: this.parseDiscount(discount),
                    source: "couponscorpion",
                    scrapedAt: new Date(),
                  });
                }
              } catch (error) {
                logger.debug(`Failed to scrape course element: ${error}`);
              }
            }

            logger.info(`couponscorpion page ${pageNum}: ${courseElements.length} courses`);
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

  private parseDiscount(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : undefined;
  }
}

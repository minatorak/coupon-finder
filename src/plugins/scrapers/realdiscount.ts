import { ScraperPlugin, Course } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";

export class RealdiscountScraper implements ScraperPlugin {
  name = "realdiscount" as const;

  async scrape(pages: number): Promise<Course[]> {
    const browser = await setupBrowser();
    const courses: Course[] = [];

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          await retryWithTimeout(async () => {
            logger.debug(`Scraping real.discount page ${pageNum}...`);

            await page.goto(
              "https://www.real.discount/coursespage/1/",
              { waitUntil: "networkidle" }
            );

            // Navigate to target page if not page 1
            if (pageNum > 1) {
              const pageButton = `button[aria-label="Go to page ${pageNum}"]`;
              const exists = await page.locator(pageButton).isVisible();
              if (exists) {
                await page.click(pageButton);
                await page.waitForTimeout(2000);
              }
            }

            // Scrape courses
            const courseElements = await page.locator(".course-card").all();

            for (const el of courseElements) {
              try {
                const title = await el
                  .locator(".course-title")
                  .textContent();
                const url = await el.locator("a").getAttribute("href");
                const discount = await el
                  .locator(".discount")
                  .textContent();

                if (title && url) {
                  courses.push({
                    url: this.resolveUrl(url),
                    title: title.trim(),
                    couponCodes: [],
                    discount: this.parseDiscount(discount),
                    source: "realdiscount",
                    scrapedAt: new Date(),
                  });
                }
              } catch (error) {
                logger.debug(`Failed to scrape course element: ${error}`);
              }
            }

            logger.info(`realdiscount page ${pageNum}: ${courseElements.length} courses`);
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

  private resolveUrl(url: string): string {
    // Handle tracking URLs (trk.udemy.com)
    if (url.includes("trk.udemy.com")) {
      try {
        const params = new URL(url).searchParams;
        return params.get("u") || url;
      } catch {
        return url;
      }
    }
    return url;
  }

  private parseDiscount(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : undefined;
  }
}

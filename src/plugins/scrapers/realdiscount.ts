import { ScraperPlugin, Course, BrowserType } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import {
  CourseSeed,
  scrapeCoursePage,
  withConcurrentPages,
} from "../../utils/scraper";

export class RealdiscountScraper implements ScraperPlugin {
  name = "realdiscount" as const;

  async scrape(pages: number, parallel: number, headless?: boolean, browser?: BrowserType): Promise<Course[]> {
    const browserInstance = await setupBrowser(headless, browser);
    const courses: Course[] = [];

    try {
      const context = await browserInstance.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          const seeds = await retryWithTimeout(async () => {
            logger.debug(`Scraping realdiscount source page ${pageNum}...`);

            await page.goto("https://www.real.discount/courses?page=1", {
              waitUntil: "networkidle",
            });

            if (pageNum > 1) {
              const pageButton = `button[aria-label="Go to page ${pageNum}"]`;
              const exists = await page
                .locator(pageButton)
                .isVisible()
                .catch(() => false);

              if (exists) {
                await page.click(pageButton);
                await page.waitForTimeout(2000);
              }
            }

            const courseElements = await page.locator(".course-card").all();
            const seedCourses: CourseSeed[] = [];

            for (const el of courseElements) {
              try {
                const title = await el.locator(".course-title").textContent();
                const link = await el.locator("a").getAttribute("href");
                const discount = await el.locator(".discount").textContent();

                if (title && link) {
                  seedCourses.push({
                    coursePageUrl: new URL(link.trim(), page.url()).href,
                    title: title.trim(),
                    discount: this.parseDiscount(discount),
                  });
                }
              } catch (error) {
                logger.debug(`Failed to scrape realdiscount course seed: ${error}`);
              }
            }

            logger.info(
              `realdiscount source page ${pageNum}: ${seedCourses.length} course pages`
            );

            return seedCourses;
          });

          const resolvedCourses = await withConcurrentPages(
            context,
            seeds,
            parallel,
            async (coursePage, seed) =>
              retryWithTimeout(
                () => scrapeCoursePage(coursePage, seed, this.name),
                3,
                5000
              )
          );

          courses.push(...resolvedCourses);
        } catch (error) {
          logger.warn(`Failed to scrape realdiscount source page ${pageNum}: ${error}`);
        }
      }

      await context.close();
    } finally {
      await closeBrowser(browserInstance);
    }

    return courses;
  }

  private parseDiscount(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)%/);
    return match ? Number.parseInt(match[1], 10) : undefined;
  }
}

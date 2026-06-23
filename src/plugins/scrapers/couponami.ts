import { ScraperPlugin, Course, BrowserType } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import {
  CourseSeed,
  scrapeCoursePage,
  withConcurrentPages,
} from "../../utils/scraper";

export class CouponamiScraper implements ScraperPlugin {
  name = "couponami" as const;

  async scrape(pages: number, parallel: number, headless?: boolean, browser?: BrowserType): Promise<Course[]> {
    const browserInstance = await setupBrowser(headless, browser);
    const courses: Course[] = [];

    try {
      const context = await browserInstance.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          const seeds = await retryWithTimeout(async () => {
            logger.debug(`Scraping couponami source page ${pageNum}...`);

            const url = `https://www.couponami.com/all/${pageNum}`;
            await page.goto(url, { waitUntil: "networkidle" });

            const courseElements = await page.locator(".course").all();
            const seedCourses: CourseSeed[] = [];

            for (const el of courseElements) {
              try {
                const isGiveaway = await el
                  .locator(".giveaway-badge")
                  .isVisible()
                  .catch(() => false);
                if (isGiveaway) continue;

                const title = await el.locator(".title").textContent();
                const link = await el.locator("a").getAttribute("href");
                const price = await el.locator(".price").textContent();

                if (title && link) {
                  seedCourses.push({
                    coursePageUrl: new URL(link.trim(), url).href,
                    title: title.trim(),
                    discount: price === "FREE" ? 100 : undefined,
                  });
                }
              } catch (error) {
                logger.debug(`Failed to scrape couponami course seed: ${error}`);
              }
            }

            logger.info(
              `couponami source page ${pageNum}: ${seedCourses.length} course pages`
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
          logger.warn(`Failed to scrape couponami source page ${pageNum}: ${error}`);
        }
      }

      await context.close();
    } finally {
      await closeBrowser(browserInstance);
    }

    return courses;
  }
}

import { ScraperPlugin, Course, BrowserType } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import {
  CourseSeed,
  scrapeCoursePage,
  withConcurrentPages,
} from "../../utils/scraper";

export class UdemyxpertScraper implements ScraperPlugin {
  name = "udemyxpert" as const;

  async scrape(pages: number, parallel: number, headless?: boolean, browser?: BrowserType): Promise<Course[]> {
    const browserInstance = await setupBrowser(headless, browser);
    const courses: Course[] = [];

    try {
      const context = await browserInstance.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          const seeds = await retryWithTimeout(async () => {
            logger.debug(`Scraping udemyxpert source page ${pageNum}...`);

            const url =
              pageNum === 1
                ? "https://udemyxpert.com/courses/"
                : `https://udemyxpert.com/courses/page/${pageNum}/`;

            await page.goto(url, { waitUntil: "networkidle" });

            const courseElements = await page.locator(".course-card").all();
            const seedCourses: CourseSeed[] = [];

            for (const el of courseElements) {
              try {
                const title = await el.locator(".title").textContent();
                const link = await el.locator("a").getAttribute("href");
                const discount = await el.locator(".badge").textContent();

                if (title && link) {
                  seedCourses.push({
                    coursePageUrl: new URL(link.trim(), url).href,
                    title: title.trim(),
                    discount: this.parseDiscount(discount),
                  });
                }
              } catch (error) {
                logger.debug(`Failed to scrape udemyxpert course seed: ${error}`);
              }
            }

            logger.info(
              `udemyxpert source page ${pageNum}: ${seedCourses.length} course pages`
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
          logger.warn(`Failed to scrape udemyxpert source page ${pageNum}: ${error}`);
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

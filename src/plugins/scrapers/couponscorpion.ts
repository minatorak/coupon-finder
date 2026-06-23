import { ScraperPlugin, Course, BrowserType } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import {
  CourseSeed,
  scrapeCoursePage,
  withConcurrentPages,
} from "../../utils/scraper";
export class CouponscorpionScraper implements ScraperPlugin {
  name = "couponscorpion" as const;
  private readonly COURSE_LINK_SELECTOR =
    "article.col_item.offer_grid h3.flowhidden a";

  async scrape(
    pages: number,
    parallel: number,
    headless?: boolean,
    browser?: BrowserType,
  ): Promise<Course[]> {
    const courses: Course[] = [];

    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      try {
        const pageCourses = await retryWithTimeout(
          () => this.scrapePage(pageNum, headless, browser, parallel),
          3,
          120000,
        );
        courses.push(...pageCourses);
      } catch (error) {
        logger.warn(
          `couponscorpion page ${pageNum} failed after retries: ${error}`,
        );
      }
    }

    logger.info(`couponscorpion: ${courses.length} courses total`);
    return courses;
  }

  private async scrapePage(
    pageNum: number,
    headless?: boolean,
    browser?: BrowserType,
    parallel?: number,
  ): Promise<Course[]> {
    const browserInstance = await setupBrowser(headless, browser);

    try {
      const context = await browserInstance.newContext();
      const page = await context.newPage();

      const url =
        pageNum === 1
          ? "https://couponscorpion.com/"
          : `https://couponscorpion.com/page/${pageNum}/`;

      logger.debug(`Scraping couponscorpion list page ${pageNum}: ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(this.COURSE_LINK_SELECTOR, {
        timeout: 30000,
      });

      const courseElements = await page
        .locator(this.COURSE_LINK_SELECTOR)
        .all();

      const seeds: CourseSeed[] = [];

      for (const el of courseElements) {
        try {
          const link = await el.getAttribute("href");
          const title = await el.textContent();

          if (title && link) {
            seeds.push({
              coursePageUrl: new URL(link.trim(), url).href,
              title: title.trim(),
            });
          }
        } catch (error) {
          logger.debug(`Failed to extract course seed: ${error}`);
        }
      }

      logger.info(
        `couponscorpion list page ${pageNum}: ${seeds.length} courses`,
      );

      const resolvedCourses = await withConcurrentPages(
        context,
        seeds,
        parallel ?? 4,
        async (coursePage, seed) =>
          retryWithTimeout(
            () => scrapeCoursePage(coursePage, seed, this.name),
            2,
            30000,
          ),
      );

      for (const course of resolvedCourses) {
        logger.info(
          `couponscorpion: ${course.title} -> ${course.udemyUrl} (coupons: ${course.couponCodes.join(", ") || "none"})`,
        );
      }

      await context.close();
      return resolvedCourses;
    } finally {
      await closeBrowser(browserInstance);
    }
  }
}

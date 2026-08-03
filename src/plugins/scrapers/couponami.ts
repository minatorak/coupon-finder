import { BrowserType, Course, ScraperPlugin } from "../../types";
import { closeBrowser, setupBrowser } from "../../utils/browser";
import { logger } from "../../utils/logger";
import { retryWithTimeout } from "../../utils/retry";
import {
  canonicalizeUdemyUrl,
  CourseSeed,
  extractCouponCodes,
  withConcurrentPages,
} from "../../utils/scraper";
import { Page } from "playwright";

const BASE_URL = "https://www.couponami.com/all";
const COURSE_LINK_SELECTOR = "article.ui.cards section.card a.card-header[href]";
const TAKE_COURSE_SELECTOR = "a.discBtn[href]";
const UDEMY_COURSE_SELECTOR = 'a[href*="udemy.com/course/"]';

export class CouponamiScraper implements ScraperPlugin {
  name = "couponami" as const;

  async scrape(
    pages: number,
    parallel: number,
    headless?: boolean,
    browser?: BrowserType,
  ): Promise<Course[]> {
    const browserInstance = await setupBrowser(headless, browser);
    const courses: Course[] = [];

    try {
      const context = await browserInstance.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        try {
          const seeds = await retryWithTimeout(
            () => this.pagination(page, pageNum),
            3,
            30000,
          );

          const resolvedCourses = await withConcurrentPages(
            context,
            seeds,
            parallel,
            (coursePage, seed) =>
              retryWithTimeout(
                () => this.fetchCourse(coursePage, seed),
                2,
                30000,
              ),
          );

          courses.push(...resolvedCourses);
        } catch (error) {
          logger.warn(`couponami page ${pageNum} failed: ${error}`);
        }
      }

      await context.close();
    } finally {
      await closeBrowser(browserInstance);
    }

    logger.info(`couponami: ${courses.length} courses total`);
    return courses;
  }

  private async pagination(page: Page, pageNum: number): Promise<CourseSeed[]> {
    const url = pageNum === 1 ? BASE_URL : `${BASE_URL}/${pageNum}`;

    logger.debug(`couponami page ${pageNum}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(COURSE_LINK_SELECTOR, { timeout: 30000 });

    const courseLinks = await page.locator(COURSE_LINK_SELECTOR).all();
    const seeds: CourseSeed[] = [];

    for (const courseLink of courseLinks) {
      try {
        const [title, href] = await Promise.all([
          courseLink.textContent(),
          courseLink.getAttribute("href"),
        ]);
        if (title && href) {
          seeds.push({
            coursePageUrl: new URL(href.trim(), url).href,
            title: title.trim(),
          });
        }
      } catch (error) {
        logger.debug(`couponami seed extract failed: ${error}`);
      }
    }

    logger.info(`couponami page ${pageNum}: ${seeds.length} courses`);
    return seeds;
  }

  private async fetchCourse(
    coursePage: Page,
    seed: CourseSeed,
  ): Promise<Course | null> {
    try {
      await coursePage.goto(seed.coursePageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      const takeCourseHref = await coursePage
        .locator(TAKE_COURSE_SELECTOR)
        .first()
        .getAttribute("href");
      if (!takeCourseHref) {
        logger.debug(`couponami: no Take Course link for ${seed.title}`);
        return null;
      }

      await coursePage.goto(new URL(takeCourseHref, coursePage.url()).href, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      const udemyCourseHref = await coursePage
        .locator(UDEMY_COURSE_SELECTOR)
        .first()
        .getAttribute("href");
      if (!udemyCourseHref) {
        logger.debug(`couponami: no Udemy link for ${seed.title}`);
        return null;
      }

      const resolvedUrl = new URL(udemyCourseHref, coursePage.url()).href;
      const udemyUrl = canonicalizeUdemyUrl(resolvedUrl);

      return {
        udemyUrl,
        url: udemyUrl,
        title: seed.title,
        couponCodes: extractCouponCodes(resolvedUrl),
        sourceType: this.name,
        source: this.name,
        scrapedAt: new Date(),
      };
    } catch (error) {
      logger.debug(`couponami fetch failed for ${seed.title}: ${error}`);
      return null;
    }
  }
}

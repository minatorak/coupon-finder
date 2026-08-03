import { ScraperPlugin, Course, BrowserType } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import { Page } from "playwright";
import {
  CourseSeed,
  canonicalizeUdemyUrl,
  extractCouponCodes,
  withConcurrentPages,
} from "../../utils/scraper";

const COURSE_LINK_SELECTOR = "article.col_item.offer_grid h3.flowhidden a";
const BASE_URL = "https://couponscorpion.com";

export class CouponscorpionScraper implements ScraperPlugin {
  name = "couponscorpion" as const;

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
            60000,
          );
          if (seeds.length === 0) {
            logger.debug(`couponscorpion page ${pageNum}: no seeds found`);
            continue;
          }

          const resolved = await withConcurrentPages(
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

          for (const course of resolved) {
            const codes = course.couponCodes?.length ? course.couponCodes.join(", ") : "none";
            logger.info(
              `couponscorpion: ${course.title} -> ${course.udemyUrl} (coupons: ${codes})`,
            );
          }

          courses.push(...resolved);
        } catch (error) {
          logger.warn(`couponscorpion page ${pageNum} failed: ${error}`);
        }
      }

      await context.close();
    } finally {
      await closeBrowser(browserInstance);
    }

    logger.info(`couponscorpion: ${courses.length} courses total`);
    return courses;
  }

  private async pagination(
    page: Page,
    pageNum: number,
  ): Promise<CourseSeed[]> {
    const url =
      pageNum === 1 ? BASE_URL : `${BASE_URL}/page/${pageNum}/`;

    logger.debug(`couponscorpion page ${pageNum}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(COURSE_LINK_SELECTOR, { timeout: 30000 });

    const courseElements = await page.locator(COURSE_LINK_SELECTOR).all();
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
        logger.debug(`couponscorpion seed extract failed: ${error}`);
      }
    }

    logger.info(`couponscorpion page ${pageNum}: ${seeds.length} courses`);
    return seeds;
  }

  private async fetchCourse(
    coursePage: Page,
    seed: CourseSeed,
  ): Promise<Course | null> {
    // 1) Open the course detail page on couponscorpion
    try {
      await coursePage.goto(seed.coursePageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    } catch {
      return null;
    }

    // 2) Find the "GET COUPON CODE" button redirect URL
    const outLink = await coursePage
      .locator('a[href*="out.php"]')
      .getAttribute("href");
    if (!outLink) {
      logger.debug(`couponscorpion: no out.php link for ${seed.title}`);
      return null;
    }

    // 3) Follow the redirect chain. Playwright auto-follows 302/307.
    //    Final URL will be a Udemy page (even if just Cloudflare challenge)
    //    that carries couponCode in the query string.
    try {
      await coursePage.goto(outLink, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
    } catch {
      return null;
    }

    const finalUrl = coursePage.url();

    // 4) Extract Udemy course URL and coupon codes from the final URL
    const udemyMatch = finalUrl.match(
      /(https?:\/\/(?:www\.)?udemy\.com\/course\/[^/?]+)/i,
    );
    if (!udemyMatch) {
      logger.debug(
        `couponscorpion: no Udemy URL after redirect for ${seed.title}`,
      );
      return null;
    }

    const udemyUrl = canonicalizeUdemyUrl(udemyMatch[1]);
    const couponCodes = extractCouponCodes(finalUrl);

    logger.debug(
      `couponscorpion fetchCourse: ${seed.title} -> ${udemyUrl} codes=${couponCodes.join(",")}`,
    );

    return {
      udemyUrl,
      url: udemyUrl,
      title: seed.title,
      couponCodes,
      sourceType: this.name,
      scrapedAt: new Date(),
    };
  }
}

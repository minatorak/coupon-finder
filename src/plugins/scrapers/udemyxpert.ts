import { Page } from "playwright";
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

const BASE_URL = "https://udemyxpert.com/courses";
const COURSE_LINK_SELECTOR = 'main a[href^="/courses/"]';
const COUPON_LINK_SELECTOR = 'a[href*="udemy.com/course/"]';

export class UdemyxpertScraper implements ScraperPlugin {
  name = "udemyxpert" as const;

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

      try {
        for (let pageNum = 1; pageNum <= pages; pageNum++) {
          try {
            const seeds = await retryWithTimeout(
              () => this.pagination(page, pageNum),
              3,
              30000,
            );
            if (seeds.length === 0) {
              logger.debug(`udemyxpert page ${pageNum}: no course pages found`);
              continue;
            }

            const resolved = await withConcurrentPages(
              context,
              seeds,
              parallel,
              (coursePage, seed) =>
                retryWithTimeout(
                  () => this.fetch(coursePage, seed),
                  3,
                  30000,
                ),
            );

            courses.push(...resolved);
          } catch (error) {
            logger.warn(`udemyxpert page ${pageNum} failed: ${error}`);
          }
        }
      } finally {
        await context.close();
      }
    } finally {
      await closeBrowser(browserInstance);
    }

    logger.info(`udemyxpert: ${courses.length} courses total`);
    return courses;
  }

  private async pagination(page: Page, pageNum: number): Promise<CourseSeed[]> {
    const url = pageNum === 1 ? BASE_URL : `${BASE_URL}?page=${pageNum}`;
    logger.debug(`udemyxpert page ${pageNum}: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(COURSE_LINK_SELECTOR, { timeout: 30000 });

    const courseElements = await page.locator(COURSE_LINK_SELECTOR).all();
    const seeds: CourseSeed[] = [];

    for (const element of courseElements) {
      try {
        const href = await element.getAttribute("href");
        const image = element.locator("img").first();
        const title = await image.getAttribute("alt");
        const discount = await element
          .locator(".badge--discount")
          .first()
          .textContent({ timeout: 2000 })
          .catch(() => null);

        if (href && title) {
          seeds.push({
            coursePageUrl: new URL(href, url).href,
            title: title.trim(),
            discount: this.parseDiscount(discount),
          });
        }
      } catch (error) {
        logger.debug(`udemyxpert seed extract failed: ${error}`);
      }
    }

    logger.info(`udemyxpert page ${pageNum}: ${seeds.length} courses`);
    return seeds;
  }

  private async fetch(page: Page, seed: CourseSeed): Promise<Course | null> {
    await page.goto(seed.coursePageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const couponLink = page.locator(COUPON_LINK_SELECTOR).filter({
      hasText: "Get Coupon",
    });
    const href = await couponLink.first().getAttribute("href");
    if (!href) {
      logger.debug(`udemyxpert: no coupon link for ${seed.title}`);
      return null;
    }

    const couponUrl = new URL(href, seed.coursePageUrl).href;
    const udemyUrl = canonicalizeUdemyUrl(couponUrl);
    const couponCodes = extractCouponCodes(couponUrl);

    logger.debug(
      `udemyxpert fetch: ${seed.title} -> ${udemyUrl} codes=${couponCodes.join(",")}`,
    );

    return {
      udemyUrl,
      url: udemyUrl,
      title: seed.title,
      couponCodes,
      discount: seed.discount,
      sourceType: this.name,
      source: this.name,
      scrapedAt: new Date(),
    };
  }

  private parseDiscount(text: string | null): number | undefined {
    const match = text?.match(/(\d+)\s*%/);
    return match ? Number.parseInt(match[1], 10) : undefined;
  }
}

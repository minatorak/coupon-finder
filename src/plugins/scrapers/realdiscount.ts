import { ScraperPlugin, Course, BrowserType } from "../../types";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import {
  canonicalizeUdemyUrl,
  extractCouponCodes,
} from "../../utils/scraper";

interface ApiCourse {
  id: number | string;
  name: string;
  url: string;
  slug: string;
  store: string;
  type: string;
}

interface ApiResponse {
  items: ApiCourse[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

const API_BASE = "https://cdn.real.discount/api/courses";
const PAGE_LIMIT = 12;

export class RealdiscountScraper implements ScraperPlugin {
  name = "realdiscount" as const;

  async scrape(pages: number, parallel: number, headless?: boolean, browser?: BrowserType): Promise<Course[]> {
    const courses: Course[] = [];

    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      try {
        const pageCourses = await retryWithTimeout(
          () => this.fetchPage(pageNum),
          2,
          15000,
        );
        logger.debug(`realdiscount page ${pageNum}: ${pageCourses.length} courses`);
        courses.push(...pageCourses);
      } catch (error) {
        logger.warn(`realdiscount page ${pageNum} failed: ${error}`);
      }
    }

    logger.info(`realdiscount: ${courses.length} courses total`);
    return courses;
  }

  private async fetchPage(pageNum: number): Promise<Course[]> {
    const url = `${API_BASE}?page=${pageNum}&limit=${PAGE_LIMIT}&sortBy=sale_start&store=Udemy`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as ApiResponse;

    return data.items
      .filter((item) => item.store === "Udemy" && item.type === "external")
      .map((item) => {
        const udemyUrl = canonicalizeUdemyUrl(item.url);
        const couponCodes = extractCouponCodes(item.url);

        return {
          udemyUrl,
          title: item.name,
          couponCodes,
          sourceType: this.name,
          scrapedAt: new Date(),
        };
      });
  }
}

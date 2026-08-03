import { UdemyUser } from "../types";
import { logger } from "../utils/logger";

const UDEMY_BASE_URL = "https://www.udemy.com/api-2.0";

export interface CourseInfo {
  id: number;
  title: string;
  isPaid: boolean;
  price: number;
  priceString: string;
  originalPrice: number;
  originalPriceString: string;
}

export interface CouponResult {
  valid: boolean;
  isFree: boolean;
  price: number;
  priceString: string;
  originalPrice: number;
  originalPriceString: string;
  discountPercent: number;
}

export class UdemyAPI {
  private courseCache = new Map<string, CourseInfo>();
  private couponCache = new Map<string, CouponResult>();
  private enrollmentCache = new Map<number, boolean>();

  constructor(private authToken: string) {}

  private async request(
    endpoint: string,
    options: RequestInit = {},
    retries = 2,
  ): Promise<any> {
    const url = `${UDEMY_BASE_URL}${endpoint}`;

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${this.authToken}`);
    headers.set("Content-Type", "application/json");
    headers.set("User-Agent", "coupon-finder/0.1.0");

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });
        if (response.ok) return response.json();
        throw new Error(`HTTP ${response.status}`);
      } catch (err) {
        if (attempt < retries) {
          const wait = (attempt + 1) * 3000;
          logger.debug(`API retry ${attempt + 1}/${retries} after ${wait}ms for ${endpoint}`);
          await new Promise((r) => setTimeout(r, wait));
        } else {
          throw err;
        }
      }
    }
  }

  async getMe(): Promise<UdemyUser> {
    logger.debug("Fetching user info from Udemy API...");
    const data = await this.request("/users/me/");

    return {
      id: data.id,
      name: data.display_name || data.first_name || "User",
      email: data.email,
      title: data.title,
    };
  }

  async getCourseInfo(slug: string): Promise<CourseInfo | null> {
    if (this.courseCache.has(slug)) {
      return this.courseCache.get(slug)!;
    }

    try {
      const data = await this.request(
        `/courses/${encodeURIComponent(slug)}/?fields[course]=id,title,is_paid,price_detail,url`,
      );

      const priceDetail = data.price_detail || {};
      const listPrice = priceDetail.list_price || {};
      const origPrice = priceDetail.price || {};

      const isPaid = data.is_paid !== false;
      const currentPrice = listPrice.amount ?? (isPaid ? undefined : 0);

      const info: CourseInfo = {
        id: data.id,
        title: data.title || slug,
        isPaid,
        price: currentPrice ?? 0,
        priceString: currentPrice !== undefined ? (listPrice.price_string ?? "") : "Free",
        originalPrice: origPrice.amount ?? 0,
        originalPriceString: origPrice.price_string ?? "",
      };

      this.courseCache.set(slug, info);
      return info;
    } catch (error) {
      logger.debug(`Failed to get course info for ${slug}: ${error}`);
      return null;
    }
  }

  async isEnrolled(courseId: number): Promise<boolean> {
    if (this.enrollmentCache.has(courseId)) {
      return this.enrollmentCache.get(courseId)!;
    }
    try {
      await this.request(`/users/me/subscribed-courses/${courseId}/`);
      this.enrollmentCache.set(courseId, true);
      return true;
    } catch {
      this.enrollmentCache.set(courseId, false);
      return false;
    }
  }

  async checkCoupon(courseId: number, couponCode: string): Promise<CouponResult | null> {
    const cacheKey = `${courseId}:${couponCode.toUpperCase()}`;
    if (this.couponCache.has(cacheKey)) {
      return this.couponCache.get(cacheKey)!;
    }

    try {
      const data = await this.request(
        `/pricing/?course_ids=${courseId}&couponCode=${encodeURIComponent(couponCode)}&fields[pricing_result]=price,list_price,discount_percent`,
      );
      const coursePricing = data?.courses?.[String(courseId)];
      if (!coursePricing) {
        logger.debug(`No pricing data for course ${courseId} coupon ${couponCode}`);
        return null;
      }

      const price = coursePricing.price || {};
      const listPrice = coursePricing.list_price || {};
      const result: CouponResult = {
        valid: true,
        isFree: price.amount === 0,
        price: price.amount ?? 0,
        priceString: price.price_string ?? "",
        originalPrice: listPrice.amount ?? 0,
        originalPriceString: listPrice.price_string ?? "",
        discountPercent: coursePricing.discount_percent ?? 0,
      };

      this.couponCache.set(cacheKey, result);
      return result;
    } catch (error) {
      logger.debug(`Coupon check failed for ${courseId} / ${couponCode}: ${error}`);
      return null;
    }
  }
}

export async function createUdemyAPI(authToken: string): Promise<UdemyAPI> {
  const api = new UdemyAPI(authToken);

  try {
    await api.getMe();
    logger.debug("Udemy API initialized successfully");
  } catch (error) {
    throw new Error(
      `Invalid Udemy session. Please log in to Udemy in your browser: https://www.udemy.com/join/login-popup/`
    );
  }

  return api;
}

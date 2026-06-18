// All TypeScript interfaces for coupon-finder

export interface Course {
  url: string;
  title: string;
  instructor?: string;
  couponCodes: string[];
  discount?: number;
  price?: number;
  originalPrice?: number;
  source: SourceType;
  scrapedAt: Date;
  enrolled?: boolean;
  claimable?: boolean;
  claimError?: string;
}

export type SourceType =
  | "couponscorpion"
  | "realdiscount"
  | "udemyxpert"
  | "discudemy";

export interface Config {
  pages: number;
  sources: SourceType[];
  parallel: boolean;
  browser: "firefox" | "chrome" | "brave";
  headless: boolean;
  autoOpen: boolean;
  expandCoupons: boolean;
  resultsDir: string;
}

export interface BrowserPlugin {
  name: "firefox" | "chrome" | "brave" | "safari";
  init(): Promise<void>;
  findCookies(): Promise<string>;
  findSessionFile(): Promise<string>;
}

export interface ScraperPlugin {
  name: SourceType;
  scrape(pages: number): Promise<Course[]>;
}

export interface UdemySession {
  csrfToken: string;
  sessionId: string;
  userId: number;
}

export interface UdemyUser {
  id: number;
  name: string;
  email: string;
  title?: string;
}

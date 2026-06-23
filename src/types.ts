// All TypeScript interfaces for coupon-finder

export const SOURCE_TYPES = [
  "couponscorpion",
  "realdiscount",
  "udemyxpert",
  "couponami",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export interface Course {
  udemyUrl: string;
  title: string;
  couponCodes: string[];
  sourceType: SourceType;
  scrapedAt: Date;
  url?: string;
  source?: SourceType;
  instructor?: string;
  discount?: number;
  price?: number;
  originalPrice?: number;
  enrolled?: boolean;
  claimable?: boolean;
  claimError?: string;
}

export interface Config {
  pages: number;
  sources: SourceType[];
  sourceParallel: boolean;
  parallel: number;
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

export type BrowserType = "firefox" | "chromium";

export interface ScraperPlugin {
  name: SourceType;
  scrape(pages: number, parallel: number, headless?: boolean, browser?: BrowserType): Promise<Course[]>;
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

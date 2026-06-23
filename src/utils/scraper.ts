import { BrowserContext, Page } from "playwright";
import { Course, SourceType } from "../types";
import { logger } from "./logger";

export interface CourseSeed {
  coursePageUrl: string;
  title: string;
  discount?: number;
}

interface LinkCandidate {
  href: string;
  text: string;
}

export function canonicalizeUdemyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.endsWith("/")
      ? parsed.pathname
      : `${parsed.pathname}/`;

    return `${parsed.origin}${pathname}`;
  } catch {
    return url;
  }
}

export function isUdemyUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "udemy.com" || host.endsWith(".udemy.com");
  } catch {
    return false;
  }
}

export function extractCouponCodes(url: string, text = ""): string[] {
  const codes = new Set<string>();

  try {
    const parsed = new URL(url);
    for (const key of ["couponCode", "couponcode", "coupon", "code"]) {
      const value = parsed.searchParams.get(key);
      if (value) {
        codes.add(value.trim());
      }
    }
  } catch {
    // Ignore invalid URLs.
  }

  const patterns = [
    /coupon(?:\s*code)?[:=\s-]+([A-Za-z0-9_-]{4,})/gi,
    /promo(?:tion)?\s*code[:=\s-]+([A-Za-z0-9_-]{4,})/gi,
    /use\s*code[:=\s-]+([A-Za-z0-9_-]{4,})/gi,
    /couponCode=([A-Za-z0-9_-]+)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1]?.trim();
      if (code) {
        codes.add(code);
      }
    }
  }

  return Array.from(codes);
}

export function extractUdemyUrlFromText(text: string): string | null {
  const match = text.match(
    /https?:\/\/(?:www\.)?udemy\.com\/course\/[^\s"'<>)]*/i
  );

  if (!match) {
    return null;
  }

  return match[0].replace(/[)\].,;]+$/, "");
}

function scoreCandidate(candidate: LinkCandidate, currentHost: string): number {
  const href = candidate.href.toLowerCase();
  const text = candidate.text.toLowerCase();
  let score = 0;

  if (isUdemyUrl(candidate.href)) {
    score += 100;
  }

  if (href.includes("couponcode=")) {
    score += 90;
  }

  if (
    href.includes("out.php") ||
    href.includes("redirect") ||
    href.includes("go=") ||
    href.includes("track")
  ) {
    score += 70;
  }

  if (text.includes("udemy")) {
    score += 40;
  }

  if (
    text.includes("coupon") ||
    text.includes("offer") ||
    text.includes("free") ||
    text.includes("get")
  ) {
    score += 20;
  }

  try {
    const host = new URL(candidate.href).hostname.toLowerCase();
    if (host === currentHost) {
      if (
        href.includes("out.php") ||
        href.includes("couponcode=") ||
        href.includes("go=")
      ) {
        score += 30;
      } else {
        score -= 25;
      }
    } else {
      score += 10;
    }
  } catch {
    // Ignore invalid URLs.
  }

  return score;
}

async function getAnchorCandidates(page: Page): Promise<LinkCandidate[]> {
  try {
    const baseUrl = page.url();
    return await page.locator("a[href]").evaluateAll((elements, baseHref) => {
      const base = String(baseHref);
      return elements
        .map((element) => {
          const anchor = element as {
            getAttribute(name: string): string | null;
            textContent: string | null;
          };
          const rawHref = anchor.getAttribute("href");
          if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("#")) {
            return null;
          }

          try {
            return {
              href: new URL(rawHref, base).href,
              text: (anchor.textContent || anchor.getAttribute("aria-label") || "")
                .replace(/\s+/g, " ")
                .trim(),
            };
          } catch {
            return null;
          }
        })
        .filter((candidate): candidate is LinkCandidate => candidate !== null);
    }, baseUrl);
  } catch {
    return [];
  }
}

async function readPageText(page: Page): Promise<string> {
  return page
    .locator("body")
    .textContent()
    .then((text) => text ?? "")
    .catch(() => "");
}

async function resolveUdemyCourseUrl(page: Page): Promise<{
  udemyUrl: string;
  couponCodes: string[];
} | null> {
  const visited = new Set<string>();
  const couponCodes = new Set<string>();

  for (let attempt = 0; attempt < 4; attempt++) {
    const pageUrl = page.url();
    extractCouponCodes(pageUrl).forEach((code) => couponCodes.add(code));

    const pageText = await readPageText(page);
    extractCouponCodes(pageText).forEach((code) => couponCodes.add(code));

    if (isUdemyUrl(pageUrl)) {
      const udemyUrl = canonicalizeUdemyUrl(pageUrl);
      return {
        udemyUrl,
        couponCodes: Array.from(couponCodes),
      };
    }

    const textUrl = extractUdemyUrlFromText(pageText);
    if (textUrl) {
      for (const code of extractCouponCodes(textUrl)) {
        couponCodes.add(code);
      }
      return {
        udemyUrl: canonicalizeUdemyUrl(textUrl),
        couponCodes: Array.from(couponCodes),
      };
    }

    const candidates = await getAnchorCandidates(page);
    const currentHost = (() => {
      try {
        return new URL(pageUrl).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();

    const nextCandidate = candidates
      .filter((candidate) => !visited.has(candidate.href))
      .sort((a, b) => scoreCandidate(b, currentHost) - scoreCandidate(a, currentHost))[0];

    if (!nextCandidate || scoreCandidate(nextCandidate, currentHost) <= 0) {
      break;
    }

    visited.add(nextCandidate.href);
    extractCouponCodes(nextCandidate.href).forEach((code) => couponCodes.add(code));

    if (isUdemyUrl(nextCandidate.href)) {
      return {
        udemyUrl: canonicalizeUdemyUrl(nextCandidate.href),
        couponCodes: Array.from(couponCodes),
      };
    }

    try {
      await page.goto(nextCandidate.href, { waitUntil: "domcontentloaded" });
    } catch (error) {
      logger.debug(`Failed to follow course link ${nextCandidate.href}: ${error}`);
    }
  }

  const fallbackText = await readPageText(page);
  const fallbackUrl = extractUdemyUrlFromText(fallbackText);
  if (!fallbackUrl) {
    return null;
  }

  extractCouponCodes(fallbackUrl).forEach((code) => couponCodes.add(code));
  extractCouponCodes(fallbackText).forEach((code) => couponCodes.add(code));

  return {
    udemyUrl: canonicalizeUdemyUrl(fallbackUrl),
    couponCodes: Array.from(couponCodes),
  };
}

export async function scrapeCoursePage(
  page: Page,
  seed: CourseSeed,
  sourceType: SourceType
): Promise<Course | null> {
  const seedCouponCodes = extractCouponCodes(seed.coursePageUrl);

  try {
    await page.goto(seed.coursePageUrl, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (isUdemyUrl(seed.coursePageUrl)) {
      const udemyUrl = canonicalizeUdemyUrl(seed.coursePageUrl);
      return {
        udemyUrl,
        url: udemyUrl,
        title: seed.title,
        couponCodes: seedCouponCodes,
        discount: seed.discount,
        sourceType,
        source: sourceType,
        scrapedAt: new Date(),
      };
    }

    logger.debug(`Failed to open course page ${seed.coursePageUrl}: ${error}`);
    return null;
  }

  const resolved = await resolveUdemyCourseUrl(page);
  if (!resolved) {
    logger.debug(`No Udemy URL found on course page ${seed.coursePageUrl}`);
    return null;
  }

  const couponCodes = Array.from(
    new Set([...seedCouponCodes, ...resolved.couponCodes])
  );

  return {
    udemyUrl: resolved.udemyUrl,
    url: resolved.udemyUrl,
    title: seed.title,
    couponCodes,
    discount: seed.discount,
    sourceType,
    source: sourceType,
    scrapedAt: new Date(),
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R | null | undefined>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.floor(concurrency));
  const results = new Array<R | null | undefined>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  );

  return results.filter((result): result is R => result !== null && result !== undefined);
}

export async function withConcurrentPages<T, R>(
  context: BrowserContext,
  items: T[],
  concurrency: number,
  worker: (page: Page, item: T, index: number) => Promise<R | null | undefined>
): Promise<R[]> {
  return mapWithConcurrency(items, concurrency, async (item, index) => {
    const page = await context.newPage();
    try {
      return await worker(page, item, index);
    } finally {
      await page.close().catch(() => {
        // Ignore page shutdown errors.
      });
    }
  });
}

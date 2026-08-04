# Contributing to coupon-finder

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
cd coupon-finder
bun install
bunx playwright install firefox
bun run src/cli.ts --help
```

## Project Structure

- `src/` — TypeScript source code
- `src/commands/` — CLI commands (whoami, find, list, claim, config)
- `src/plugins/` — Browser & scraper plugins
- `src/udemy/` — Udemy API logic
- `src/merge/` — Course deduplication & merging
- `src/storage/` — Results persistence
- `src/utils/scraper.ts` — Shared scraper utilities (course page resolution, concurrency, URL utilities)
- `tests/` — Test files

## Adding a New Utility

1. Create `src/utils/newutil.ts`
2. Export public functions/classes
3. Import in commands that need it
4. Add tests in `tests/`

Example: The `openUrlsInBatches()` function in `src/utils/browser-opener.ts` opens 10 URLs at a time in the user's default browser, prompting for Enter between batches.

## Adding a New Scraper

The scraper system uses a **two-phase model**:

1. **Source scraping** — Extract `CourseSeed[]` from listing pages (title + coursePageUrl + discount)
2. **Course page resolution** — Open each seed's URL with bounded concurrency to find the actual Udemy URL and extract coupon codes

### Step-by-step

1. Add your source to `SOURCE_TYPES` in `src/types.ts`
2. Create `src/plugins/scrapers/newsource.ts`
3. Implement `ScraperPlugin` interface
4. Register in `src/plugins/registry.ts`
5. Test: `bun run src/cli.ts find --source newsource --pages 1`

### Example

```typescript
import { ScraperPlugin, Course, BrowserType } from "../../types";
import { setupBrowser, closeBrowser } from "../../utils/browser";
import { retryWithTimeout } from "../../utils/retry";
import { logger } from "../../utils/logger";
import {
  CourseSeed,
  scrapeCoursePage,
  withConcurrentPages,
} from "../../utils/scraper";

export class NewsourceScraper implements ScraperPlugin {
  name = "newsource" as const;

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
        const seeds = await retryWithTimeout(async () => {
          // 1. Navigate to source listing page
          await page.goto("https://source.com/page/" + pageNum, { waitUntil: "networkidle" });

          // 2. Extract CourseSeed[] from listing elements
          const elements = await page.locator(".course-card").all();
          const seeds: CourseSeed[] = [];

          for (const el of elements) {
            const title = await el.locator(".title").textContent();
            const link = await el.locator("a").getAttribute("href");
            if (title && link) {
              seeds.push({
                coursePageUrl: new URL(link.trim(), page.url()).href,
                title: title.trim(),
              });
            }
          }

          logger.info(`Source page ${pageNum}: ${seeds.length} course pages`);
          return seeds;
        });

        // 3. Resolve course pages with bounded concurrency
        const resolved = await withConcurrentPages(
          context,
          seeds,
          parallel,
          async (coursePage, seed) =>
            retryWithTimeout(
              () => scrapeCoursePage(coursePage, seed, this.name),
              3,
              5000,
            ),
        );

        courses.push(...resolved);
      }

      await context.close();
    } finally {
      await closeBrowser(browserInstance);
    }

    return courses;
  }
}
```

### Shared Utilities in `src/utils/scraper.ts`

| Function | Purpose |
|----------|---------|
| `scrapeCoursePage(page, seed, sourceType)` | Navigate to seed URL, resolve Udemy URL, extract coupon codes |
| `withConcurrentPages(context, items, n, worker)` | Open N pages concurrently in a shared browser context |
| `mapWithConcurrency(items, n, worker)` | Generic bounded-concurrency executor |
| `extractCouponCodes(url, text?)` | Extract coupon codes from URL params + text patterns |
| `canonicalizeUdemyUrl(url)` | Normalize Udemy URL (trailing slash, strip params) |
| `isUdemyUrl(url)` | Check if URL points to udemy.com |

## Code Style

- TypeScript with strict mode enabled
- 2-space indentation
- Use `logger` for console output
- Add error handling with `retryWithTimeout` for scrapers

## Testing

```bash
bun test
```

### Manual Testing the Claim --open Feature

```bash
# 1. Scrape courses
bun run src/cli.ts find --pages 1

# 2. Check enrollment (requires Firefox/Chrome/Brave with Udemy login)
bun run src/cli.ts list

# 3. Test claim with --open flag
bun run src/cli.ts claim --open
```

This will open claimed course URLs 10 at a time, waiting for Enter between batches on macOS, Linux, and Windows.

## Before Submitting

1. Run type check: `bun run tsc --noEmit`
2. Test locally: `bun run src/cli.ts whoami`
3. Format code consistently
4. Add tests for new features

## Questions?

See `PLAN.md` for architecture details or open a GitHub issue.

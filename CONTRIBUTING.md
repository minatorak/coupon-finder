# Contributing to coupon-finder

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
cd coupon-finder
bun install
bun run src/cli.ts --help
```

## Project Structure

- `src/` — TypeScript source code
- `src/commands/` — CLI commands (whoami, find, list, claim, config)
- `src/plugins/` — Browser & scraper plugins
- `src/udemy/` — Udemy API logic
- `src/merge/` — Course deduplication & merging
- `src/storage/` — Results persistence
- `tests/` — Test files

## Adding a New Utility

1. Create `src/utils/newutil.ts`
2. Export public functions/classes
3. Import in commands that need it
4. Add tests in `tests/`

Example: The `openUrlsInBatches()` function in `src/utils/browser-opener.ts` opens 10 URLs at a time in the user's default browser, prompting for Enter between batches.

## Adding a New Scraper

1. Create `src/plugins/scrapers/newsource.ts`
2. Implement `ScraperPlugin` interface
3. Register in `src/plugins/registry.ts`
4. Test: `bun run src/cli.ts find --source newsource --pages 1`

Example:

```typescript
export class NewsourceScraper implements ScraperPlugin {
  name = "newsource" as const;

  async scrape(pages: number): Promise<Course[]> {
    const browser = await setupBrowser();
    const courses: Course[] = [];

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      for (let pageNum = 1; pageNum <= pages; pageNum++) {
        // Scrape logic here
      }

      await context.close();
    } finally {
      await closeBrowser(browser);
    }

    return courses;
  }
}
```

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

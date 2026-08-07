# Contributing

## Development setup

Requirements:

- [Bun](https://bun.sh/)
- Firefox, Chrome, or Brave for browser-backed commands
- Active Udemy login for `whoami`, `list`, and `run`

```bash
git clone https://github.com/minatorak/coupon-finder.git
cd coupon-finder
bun install
bun run src/cli.ts --help
```

## Quality checks

Run before submitting change:

```bash
bunx tsc --noEmit
bun test
```

Tests are colocated with source as `src/**/*.test.ts`.

For manual smoke test that does not require Udemy account:

```bash
bun run src/cli.ts --version
bun run src/cli.ts --help
bun run src/cli.ts find --source realdiscount --pages 1
```

Account-backed workflow:

```bash
bun run src/cli.ts whoami
bun run src/cli.ts find --pages 1
bun run src/cli.ts list
bun run src/cli.ts claim
```

`claim` opens eligible URLs; it does not enroll automatically.

## Project structure

```text
src/
├── cli.ts                 command parsing and dispatch
├── commands/              command workflows and command tests
├── plugins/
│   ├── registry.ts        source and browser plugin selection
│   └── scrapers/          coupon-source plugins
├── merge/                 course URL normalization and merging
├── storage/               result persistence and cleanup
├── udemy/                 browser session and API checks
└── utils/                 shared browser, scraper, retry, and release helpers
```

See [architecture](docs/architecture.md) for data flow and module responsibilities.

## Add scraper source

Scraper must implement `ScraperPlugin` and return `Course[]`.

1. Add source name to `SOURCE_TYPES` in `src/types.ts`.
2. Add plugin under `src/plugins/scrapers/`.
3. Register plugin in `src/plugins/registry.ts`.
4. Add tests beside changed source.
5. Run source directly with `find --source`.
6. Update public source lists in README and CLI reference.

Choose source strategy based on upstream site:

- Prefer direct structured API when source exposes suitable course data.
- Otherwise scrape listing pages into `CourseSeed[]`, then resolve each source course page with shared helpers.

For browser-based source, reuse:

- `setupBrowser` and `closeBrowser` from `src/utils/browser.ts`;
- `scrapeCoursePage` for Udemy URL and coupon extraction;
- `withConcurrentPages` for bounded page concurrency;
- `retryWithTimeout` with operation-specific limits;
- `canonicalizeUdemyUrl` before emitting course URL.

Source failures should remain isolated so other configured sources can still return results.

## Code conventions

- TypeScript strict mode.
- Two-space indentation.
- Use `logger` for operational messages.
- Preserve `Course.udemyUrl` as canonical deduplication key.
- Keep coupon discovery separate from Udemy coupon validation.
- Never add automatic enrollment or checkout calls to scraper plugins.
- Never log or commit browser cookies, access tokens, private release keys, or real user data.

## Documentation changes

Public documentation is organized by reader:

- `README.md` — end-user start
- `docs/cli-reference.md` — complete commands and configuration
- `docs/architecture.md` — current implementation design
- `docs/api-udemy.md` — Udemy endpoints used by source
- `CONTEXT.md` — domain language
- `docs/releasing.md` — signed release process

Update documentation when command behavior, configuration, source list, result shape, or release contract changes. Describe implemented behavior only.

## Release work

See [release guide](docs/releasing.md). Do not commit signing private key.

# Architecture

`coupon-finder` is Bun and TypeScript CLI that discovers Udemy offers, verifies account and coupon state, and opens claimable course pages for manual enrollment.

## Workflow

```text
Coupon sources
    │
    ▼
find ── discover and resolve Udemy URLs
    │
    ├── *_scrape.json
    ▼
merge ── normalize URL, combine duplicate course data
    │
    ├── *_merged.json
    ▼
list ── Udemy session, enrollment, and pricing checks
    │
    ├── *_checked.json
    ▼
claim ── open eligible URLs in system browser
    │
    ▼
User completes enrollment on Udemy
```

`run` coordinates same `find → list → claim` sequence. It stops before `claim` when `list` produces no checked courses.

## CLI layer

`src/cli.ts` parses command and `find` options, then delegates to command modules:

- `whoami` validates current Udemy session.
- `config` creates or updates TOML configuration.
- `find` runs configured scraper plugins and merges output.
- `list` checks newest merged result against Udemy.
- `claim` opens claimable URLs in batches.
- `run` coordinates complete workflow.
- `update` verifies and replaces installed release executable.

Commands report operational errors and terminate with non-zero status.

## Discovery plugins

Scrapers implement `ScraperPlugin` from `src/types.ts` and are selected through `src/plugins/registry.ts`.

Current sources use two strategies:

- `realdiscount` fetches structured source API directly and maps returned offers into courses.
- `couponscorpion`, `udemyxpert`, and `couponami` use installed system browser through Playwright. They scrape listing pages into course seeds, then resolve source course pages into Udemy URLs and coupon codes.

Browser-based sources share URL normalization, coupon extraction, and bounded-concurrency helpers from `src/utils/scraper.ts`.

Source concurrency and course-page concurrency are separate:

- `sourceParallel` controls whether source plugins run together.
- `parallel` limits simultaneous course pages inside each browser-based source.

Retries and timeouts are selected by each source operation. Source failure is isolated: `find` keeps output from successful sources.

## Course merging

`src/merge/merger.ts` canonicalizes Udemy URLs and uses canonical URL as deduplication key.

For duplicates, merger:

- combines unique coupon codes;
- retains available metadata;
- keeps greatest numeric discount value reported by sources.

Coupon order is discovery order. Merger does not validate coupon; validation happens during `list`.

## Session and Udemy checks

`src/udemy/session.ts` locates selected browser profile, reads Udemy cookies, and extracts access token. `src/udemy/api.ts` sends bearer-authenticated requests to Udemy.

`list` processes courses sequentially:

1. Extract course slug from canonical Udemy URL.
2. Fetch course identity and pricing metadata.
3. Check whether current user is enrolled.
4. Treat intrinsically free, unenrolled course as claimable.
5. For paid course, test discovered coupon codes until free code is found or candidates are exhausted.
6. Store verified free code as `appliedCouponCode`.

A claimable course is not enrolled and either intrinsically free or reduced to zero by validated coupon. Partial discounts are recorded but are not claimable.

See [Udemy API implementation reference](api-udemy.md) for endpoints and error semantics.

## Claim behavior

`src/commands/claim.ts` loads newest checked result and selects courses where:

```text
claimable = true
enrolled = false
claimError is absent
```

It builds URL with verified coupon code and passes URLs to `src/utils/browser-opener.ts`. Opener launches default system browser in batches of 10 and waits for user between batches.

No enrollment or checkout request is sent by `claim`.

## Configuration and storage

Configuration is serialized as TOML at `~/.coupon-finder/config.toml`. Legacy JSON configuration is normalized and migrated when loaded.

Current workflow uses:

- page count and enabled sources;
- source and course-page concurrency;
- browser selection;
- headless browser mode.

Result storage is fixed at `~/.coupon-finder/results/`. `find` cleans directory entries older than three days before scraping.

## Update trust chain

Release update accepts only stable GitHub releases containing:

- platform-specific executable;
- `checksums.txt`;
- `checksums.txt.sig`.

Updater verifies manifest signature with embedded public key, verifies selected executable hash, creates one backup, and atomically replaces installed binary. See [release guide](releasing.md).

## Main modules

```text
src/
├── cli.ts                 command dispatch and option parsing
├── commands/              user-facing command workflows
├── plugins/               scraper registry and source plugins
├── merge/                 URL-based deduplication
├── storage/               JSON result persistence and cleanup
├── udemy/                 browser session and Udemy API checks
└── utils/                 browser, retry, release, and shared helpers
```

Tests are colocated with source as `src/**/*.test.ts`.

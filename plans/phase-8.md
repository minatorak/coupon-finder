# Phase 8: Course Page Resolution Pipeline

**Estimated Time:** 6-8 hours (3-4 sprints)  
**Goal:** Two-phase scrape model — source listing pages → course page resolution with bounded concurrency  
**Depends On:** Phase 7 (CLI structure, config system, version management)

---

## Architecture: Two-Phase Scrape Model

### Before (Phases 1-7)
```
Source page → Extract title, URL, discount → Push Course
```
Each scraper extracted course data directly from listing-page HTML. URLs were often intermediary (tracking/redirect pages), not actual Udemy URLs. Coupon codes were rarely extracted.

### After (Phase 8)
```
Phase 1: Source page → Extract CourseSeed[] (coursePageUrl, title, discount)
Phase 2: For each seed → Open coursePageUrl → Follow links (≤4 hops) → Resolve Udemy URL + extract coupon codes
         Concurrency: bounded by `parallel` config (default: 4)
```

### Data Flow
```
Scraper A              Scraper B
  │                       │
  ▼                       ▼
CourseSeed[]           CourseSeed[]
  │                       │
  ├── withConcurrentPages(context, seeds, parallel, scrapeCoursePage)
  │     │
  │     ├── Page 1 → Goto seed.coursePageUrl → resolveUdemyCourseUrl()
  │     │     ├── Extract coupon codes from URL params + page text
  │     │     ├── Score all <a> links (Udemy URL = 100, couponCode= = 90, redirect = 70, ...)
  │     │     ├── Follow highest-scored link → repeat (≤4 hops)
  │     │     └── Return { udemyUrl, couponCodes }
  │     ├── Page 2 → ...
  │     └── Page N → ...
  │
  ▼
All resolved Courses → Merger → Enrollment
```

---

## Config Schema Migration

| Old Config | New Config | Type Change |
|------------|-----------|-------------|
| `parallel: boolean` | `sourceParallel: boolean` | Controls whether source scrapers run in parallel |
| — | `parallel: number` (default: 4) | Max concurrent course pages open per source |

### Migration Logic (in `src/config.ts`)
- If config has `parallel: boolean` → migrate to `sourceParallel: boolean`, set `parallel: number` to default 4
- If config has `parallel: number` → use as course page concurrency, set `sourceParallel: true`
- Both fields independently configurable via `--set`

### Config Validation (in `src/config.ts`)
- `normalizePositiveInt()` — rejects NaN, <1, non-finite; floors to integer
- `normalizeBoolean()` — only accepts literal `true`/`false`
- `normalizeBrowser()` — only `firefox`/`chrome`/`brave`, defaults to `firefox`
- `normalizeSources()` — deduplicates, filters to known `SOURCE_TYPES`, migrates deprecated `"discudemy"` → `"couponami"`

---

## Shared Scraper Utilities (`src/utils/scraper.ts`)

### `CourseSeed` Interface
```typescript
interface CourseSeed {
  coursePageUrl: string;    // URL to open for resolution
  title: string;            // Course title from listing page
  discount?: number;        // Discount % from listing (if available)
}
```

### `scrapeCoursePage(page, seed, sourceType)` → `Course | null`
1. Navigate to `seed.coursePageUrl`
2. If navigation fails AND URL is already a Udemy URL → return immediately with seed coupon codes
3. Otherwise → run `resolveUdemyCourseUrl()` to find the real Udemy URL
4. Merge seed coupon codes + resolved coupon codes (deduplicated)
5. Return `Course` with `udemyUrl` as primary URL

### `resolveUdemyCourseUrl(page)` → `{ udemyUrl, couponCodes } | null`
- Extract coupon codes from current page URL params (`couponCode=`, `couponcode=`, `coupon=`, `code=`)
- Extract coupon codes from page text (regex patterns: "coupon code:", "use code:", "promo code:")
- If current URL is a Udemy URL → return immediately
- Scan all `<a href>` elements on page, score each candidate
- Follow highest-scored candidate (up to 4 hops)
- Final fallback: regex-extract Udemy URL from page text

### `extractCouponCodes(url, text?)` → `string[]`
Extracts from URL params AND text patterns, returns deduplicated array.

### `canonicalizeUdemyUrl(url)` → `string`
Normalizes: adds trailing slash, preserves origin + pathname only.

### `withConcurrentPages(context, items, concurrency, worker)` → `R[]`
Opens each item in a new page within the same `BrowserContext`, limits concurrency via `mapWithConcurrency()`. Each page closed after its worker completes.

### `mapWithConcurrency(items, concurrency, worker)` → `R[]`
Generic bounded-concurrency executor. Spawns `concurrency` worker coroutines that pick items from a shared index. Returns only non-null results.

---

## Link Scoring Algorithm

```
Score breakdown for each <a href> candidate:
  isUdemyUrl(href)                          → +100
  hasCouponCodeParam(href)                  → +90
  isRedirectLink(href, text)                → +70
  textContains("udemy")                     → +40
  textContains("coupon"|"offer"|"free"|"get") → +20
  sameHost && isRedirect                     → +30
  sameHost && !isRedirect                    → -25
  differentHost                              → +10
```

Up to 4 link-following hops per course. Exit early on Udemy URL.

---

## Concurrency Model

### Two Levels of Parallelism

| Level | Config Key | Type | Default | Description |
|-------|-----------|------|---------|-------------|
| Source | `sourceParallel` | `boolean` | `true` | Run source scrapers concurrently |
| Course Page | `parallel` | `number` | `4` | Max course pages open at once per source |

### Browser Management
- Each scraper manages its own browser instance via `setupBrowser(headless?, browser?)`
- `mapBrowserConfig()` maps `Config["browser"]` ("firefox"/"chrome"/"brave") to Playwright types ("firefox"/"chromium")

---

## CLI Flag Changes

| Old Flag | New Flag | Description |
|----------|----------|-------------|
| `--no-parallel` | `--no-source-parallel` | Sequential source scraping (old flag kept as alias) |
| — | `--source-parallel` | Enable source parallelism (explicit) |
| — | `--parallel N` | Course page concurrency per source |

---

## API Changes

### `ScraperPlugin` Interface
```typescript
// Before
scrape(pages: number): Promise<Course[]>;

// After
scrape(pages: number, parallel: number, headless?: boolean, browser?: BrowserType): Promise<Course[]>;
```

### `Course` Type
```typescript
// Before
interface Course {
  url: string;
  title: string;
  couponCodes: string[];
  source: SourceType;
  scrapedAt: Date;
}

// After
interface Course {
  udemyUrl: string;       // Canonical Udemy URL (primary)
  title: string;
  couponCodes: string[];
  sourceType: SourceType;  // New: explicitly typed
  scrapedAt: Date;
  url?: string;           // Backwards compat alias
  source?: SourceType;    // Backwards compat alias
}
```

### `Config` Type
```typescript
// Before
interface Config {
  parallel: boolean;
}

// After
interface Config {
  sourceParallel: boolean;
  parallel: number;
}
```

---

## Testing Strategy

### Unit Tests
- `canonicalizeUdemyUrl()` — trailing slash, query stripping, edge cases
- `extractCouponCodes()` — URL params, text patterns, dedup, case sensitivity
- `isUdemyUrl()` — valid udemy.com, subdomains, non-Udemy URLs
- `scoreCandidate()` — verify scoring weights produce correct rankings
- `mapWithConcurrency()` — fewer items than concurrency, more items, empty input, null results filtered
- Config normalization — old `parallel: boolean` migrates correctly, invalid values default

### Integration Tests
- Each scraper with `--pages 1 --source <name>`: returns `Course[]` with valid `udemyUrl`
- `couponCodes` array populated (from URL params or page text)
- Merger: dedup by canonical Udemy URL, coupon codes merge, `countBySource()` uses `sourceType`

### E2E Test Cases
- `coupon-finder find --pages 1 --parallel 2` — all sources resolve to udemy.com
- `coupon-finder find --no-source-parallel` — sequential mode
- `coupon-finder find --source realdiscount --pages 3` — pagination

### Config Migration Tests
- Old `"parallel": true` → loads as `sourceParallel: true`, `parallel: 4`
- Old `"parallel": false` → loads as `sourceParallel: false`, `parallel: 4`
- New config with both fields → reads correctly
- Invalid values → falls back to defaults

### Error Handling Tests
- Network timeout on course page → scraper logs warning, continues to next seed
- Course page has no Udemy URL → returns null (filtered by `withConcurrentPages`)
- Malformed coupon code → gracefully skipped
- `retryWithTimeout` wraps both source scrape AND each `scrapeCoursePage` call

---

## Per-Scraper Refactoring

### Common Pattern Applied to All 4 Scrapers
```
1. Setup browser (headless, browserType)
2. Create context + page
3. For each source page (1..pages):
   a. Navigate to listing page
   b. Extract CourseSeed[] (coursePageUrl, title, discount)
   c. withConcurrentPages(context, seeds, parallel, scrapeCoursePage)
   d. Push resolved courses
4. Close context, close browser
5. Return accumulated courses
```

### Source-Specific Details

| Scraper | Selector | Pagination | Notes |
|---------|----------|------------|-------|
| `couponami` | `.course` | Path: `/all/{page}` | Uses `price === "FREE"` for discount |
| `couponscorpion` | `article.col_item.offer_grid h3.flowhidden a` | Path: `/page/{num}/` (pg1: `/`) | Long timeout (120s) for list page |
| `realdiscount` | `.course-card` | SPA: MUI button click | `waitForTimeout(2000)` after click |
| `udemyxpert` | `.course-card` + `.title` | Path-based (pg1: `/`, rest: `/page/{num}/`) | Simple static HTML |

---

## Files Created/Modified

### New Files
- `src/utils/scraper.ts` — CourseSeed, scrapeCoursePage, resolveUdemyCourseUrl, link scoring, withConcurrentPages, mapWithConcurrency, URL utilities

### Modified Files
- `src/types.ts` — `Course.udemyUrl`, `Course.sourceType`, `SOURCE_TYPES` const, `Config` schema, `ScraperPlugin` signature, `BrowserType` type
- `src/config.ts` — Full rewrite: normalization functions, migration for old `parallel: boolean`
- `src/cli.ts` — New flags (`--parallel N`, `--source-parallel`, `--no-source-parallel`), updated help
- `src/commands/find.ts` — Pass `parallel` to scrapers, new options interface, updated logging
- `src/commands/config-cmd.ts` — Updated `--set` handling for `sourceParallel` + `parallel`
- `src/commands/claim.ts` — Use `udemyUrl` for `--open` URL collection
- `src/commands/whoami.ts` — Bugfix: `browserName` scope
- `src/merge/merger.ts` — Use `udemyUrl` for dedup, `sourceType` for counting
- `src/udemy/enrollment.ts` — Use `udemyUrl` for course ID extraction
- `src/utils/browser.ts` — Add `mapBrowserConfig()` helper
- `src/plugins/scrapers/couponami.ts` — Two-phase refactor
- `src/plugins/scrapers/couponscorpion.ts` — Two-phase refactor
- `src/plugins/scrapers/realdiscount.ts` — Two-phase refactor
- `src/plugins/scrapers/udemyxpert.ts` — Two-phase refactor

### Documentation Updated
- `README.md` — Two-stage scraping description, new flags
- `docs/api-reference.md` — Updated CLI reference
- `docs/architecture.md` — Updated architecture diagram
- `CONTRIBUTING.md` — New scraper API signature, utilities section
- `MAKEFILE_GUIDE.md` — Updated config flags and help text
- `PHASES_COMPLETE.md` — Added Phase 8 section
- `Makefile` — Updated flag names, config-help docs

---

## Implementation Order

### Sprint 1: Core Utilities (~2 hours)
1. `src/types.ts` — Add `Course.udemyUrl`, `sourceType`, update `Config` + `ScraperPlugin`
2. `src/utils/scraper.ts` — Full implementation (course seed, URL resolution, concurrency)
3. `src/utils/browser.ts` — Add `mapBrowserConfig()`
4. `src/config.ts` — Rewrite config normalization with migration
5. `src/merge/merger.ts` — Update to use `udemyUrl`/`sourceType`
6. `src/udemy/enrollment.ts` — Update to use `udemyUrl`

### Sprint 2: Scraper Refactoring (~2 hours)
7. `realdiscount.ts` — Convert to two-phase
8. `couponscorpion.ts` — Convert to two-phase
9. `udemyxpert.ts` — Convert to two-phase
10. `couponami.ts` — Convert to two-phase

### Sprint 3: CLI & Integration (~1.5 hours)
11. `src/cli.ts` — New flags, updated help
12. `src/commands/find.ts` — Pass through `parallel`, updated logging
13. `src/commands/config-cmd.ts` — Updated `--set` handling
14. `src/commands/claim.ts` — Use `udemyUrl`
15. `src/commands/whoami.ts` — Bugfix

### Sprint 4: Documentation & Testing (~1.5 hours)
16. `Makefile` — Update flag refs
17. `README.md`, `docs/api-reference.md`, `docs/architecture.md` — Update docs
18. `CONTRIBUTING.md`, `MAKEFILE_GUIDE.md` — Update docs
19. `PHASES_COMPLETE.md` — Add Phase 8 section
20. `plans/phase-8.md` — This plan document
21. Manual testing per testing strategy

---

## Success Criteria

- [ ] All 4 scrapers produce `Course[]` with valid `udemyUrl` (resolved to udemy.com)
- [ ] Course pages resolved with bounded concurrency (`parallel: N` honored)
- [ ] Coupon codes extracted from both URL params and page text
- [ ] Backwards compatible: old `"parallel": true/false` config migrates cleanly
- [ ] `--no-source-parallel` and `--no-parallel` both work (alias)
- [ ] `coupon-finder find --parallel 8` opens max 8 concurrent pages per source
- [ ] `coupon-finder find --no-source-parallel` runs sources sequentially
- [ ] Merger deduplicates by canonicalized Udemy URL
- [ ] `countBySource()` reports correct source counts
- [ ] Failed course pages don't crash the whole scrape (graceful per-seed error handling)
- [ ] No TypeScript errors (`bun run tsc --noEmit`)

---

## Out of Scope (Phase 8)

- ❌ Automatic coupon code application (still manual via `claim` command)
- ❌ Instructor-wide coupon expansion
- ❌ Udemy login page handling (must already be logged in)
- ❌ Course detail scraping (price, rating, reviews)
- ❌ Persistent browser context caching (re-created per scrape)
- ❌ Windows platform support

---

## Open Questions

1. **Link scoring weights** — Are current weights optimal for all 4 sources?
   - v0: Conservative weights; increase `isUdemyUrl` bonus if false positives occur
   - v1: Source-specific scoring overrides

2. **Browser context reuse** — Currently each scraper creates its own browser.
   - v0: Separate browsers (isolation, simpler error handling)
   - v1: Shared browser with isolated contexts

3. **Rate limiting** — Opening N course pages concurrently could trigger anti-bot.
   - v0: Respect existing retry logic; user controls `parallel`
   - v1: Add random delays between course page navigations

---

## After Phase 8

✅ All courses resolve to real Udemy URLs with coupon codes
✅ Config system validated and hardened
✅ Bounded concurrency prevents resource exhaustion
✅ Graceful per-seed error handling

**Next (Phase 9+):**
- Instructor-wide coupon expansion
- Scheduled/automatic claiming
- Performance optimizations (shared browser, caching)
- Enhanced enrollment API integration

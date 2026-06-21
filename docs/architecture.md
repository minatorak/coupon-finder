# coupon-finder Architecture

## Overview

coupon-finder is a CLI tool built with Bun + TypeScript that:
1. Reads Udemy browser sessions (Firefox, Chrome, Brave)
2. Scrapes coupon data from 4 sources in parallel
3. Deduplicates and merges results by URL
4. Checks enrollment status via Udemy API
5. Auto-enrolls in available courses

## Design Principles

- **Plugin architecture:** Browsers and scrapers are pluggable
- **Session-aware:** Reads active browser cookies, no separate login
- **Deduplication:** Collects all coupon codes per course, keeps best discount
- **Error resilience:** Retries failed scrapers with 3x attempts, 5s timeout
- **File-based storage:** JSON results, auto-cleanup after 3 days

## Data Flow

```
Browser Session
      ↓
UdemyAPI (auth check)
      ↓
[Realdiscount] [Couponscorpion] [Udemyxpert] [Couponami]
      ↓              ↓                 ↓            ↓
   Courses        Courses           Courses      Courses
      ↓
Merge by URL (collect coupon codes)
      ↓
Check Enrollment (API calls)
      ↓
Auto-Claim (if not enrolled + valid coupon)
      ↓
JSON Reports
```

## Key Components

### Commands (`src/commands/`)
- **whoami** — Validate browser session + show user info
- **find** — Run all scrapers, merge results
- **list** — Load merged results, check enrollment
- **claim** — Auto-enroll in available courses
- **config** — View/edit configuration

### Plugins (`src/plugins/`)

**Browsers** (`src/plugins/browsers/`)
- Read browser-specific cookie databases
- Support: Firefox, Chrome, Brave

**Scrapers** (`src/plugins/scrapers/`)
- Playwright-based page scraping
- 4 sources: realdiscount, couponscorpion, udemyxpert, couponami
- Configurable retry logic (3x, 5s max)

### Udemy (`src/udemy/`)
- **session.ts** — Extract Udemy auth token from browser cookies
- **api.ts** — REST API client (GET /users/me/, enrollment checks)
- **enrollment.ts** — Check and claim logic

### Merge (`src/merge/`)
- **merger.ts** — Deduplicate by URL, collect all coupon codes
- Keep best discount % as primary

### Storage (`src/storage/`)
- **results.ts** — Save/load JSON (timestamped files)
- **cleanup.ts** — Delete files older than 3 days

## Configuration

```json
{
  "pages": 1,                    // Pages to scrape per source
  "sources": [...],              // Active sources
  "parallel": true,              // Run scrapers concurrently
  "browser": "firefox",          // Browser for session
  "headless": true,              // Run Playwright headless
  "autoOpen": false,             // Auto-open URLs after claim
  "expandCoupons": true,         // Discover instructor-wide coupons
  "resultsDir": "~/.coupon-finder/results"
}
```

## Error Handling

- **Missing session:** Show helpful error + login steps
- **Scraper timeout:** Retry 3x (5s max), then skip with warning
- **Enrollment check failure:** Mark course, continue
- **Config corruption:** Reset to defaults + warn

## Performance Optimizations

- Playwright runs headless (no UI overhead)
- Images disabled in browser (save bandwidth)
- Scrapers run in parallel (by default)
- 3-day result file cleanup (manage disk)
- Retry logic with exponential backoff (graceful failures)

## Future Enhancements

- Coupon expansion: Resolve instructor-wide coupons
- Safari browser support
- Enrollment filtering (don't re-show already-enrolled)
- Advanced filtering (by category, instructor, price)
- Scheduled runs (cron-like)

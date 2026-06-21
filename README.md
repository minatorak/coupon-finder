# coupon-finder CLI

> **Find, check, and claim free Udemy courses from multiple coupon sources — all from one command.**

Coupon-finder is a command-line tool that automates discovering free Udemy courses from multiple coupon websites and auto-enrolls you via your Udemy account. Built with Bun & TypeScript for fast, single-binary distribution.

## Features

- 🔍 **Multi-source scraping:** Scrape coupons from realdiscount, couponscorpion, udemyxpert, and couponami simultaneously
- 🔗 **Session-aware:** Reads your active Udemy browser session (Firefox, Chrome, Brave) to check enrollment status
- 📊 **Deduplication:** Automatically merges results by course URL, keeping the best coupon code
- 🚀 **Auto-enrollment:** Batch-enroll in courses with valid coupons
- ⚙️ **Configurable:** JSON config at `~/.coupon-finder/config.json`
- 📦 **Self-contained:** Single executable, no Python or Node.js required
- 🧹 **Auto-cleanup:** Deletes result files older than 3 days

## Installation

```bash
curl -fsSL github.com/minatorak/coupon-finder/install.sh | bash
```

Then verify:

```bash
coupon-finder --help
```

## Quick Start

### 1. Check your Udemy login

```bash
coupon-finder whoami 
```

Output:
```
✅ Logged in as: John Doe
Browser: Firefox
Session: valid (expires 2026-07-18)
```

### 2. Find free courses (all sources)

```bash
coupon-finder find --pages 5
```

This scrapes 5 pages from each source in parallel and merges results:
```
🔍 Scraping 4 sources (parallel)...
  ✅ realdiscount: 45 courses
  ✅ couponscorpion: 38 courses
  ✅ udemyxpert: 52 courses
  ✅ couponami: 29 courses
📊 Total: 164 courses (after dedup: 120)
💾 Saved to: ~/.coupon-finder/results/2026-06-18T120500Z_merged.json
```

### 3. List claimable courses

```bash
coupon-finder list
```

Check which courses you can enroll in:
```
📋 Courses (checked against your Udemy account):
  ✅ 45 courses available (not enrolled, valid coupon)
  🔒 52 courses already enrolled
  ⚠️  23 expired coupons
  💾 Saved to: ~/.coupon-finder/results/2026-06-18T121000Z_checked.json
```

### 4. Auto-enroll in available courses

```bash
coupon-finder claim
```

Result:
```
🚀 Claiming 45 courses...
  ✅ Course 1 (50% off)
  ✅ Course 2 (30% off)
  ❌ Course 3 (coupon expired)
✅ Claimed 44/45
📊 Report: ~/.coupon-finder/results/claim_report.json
```

## Commands

### `coupon-finder whoami`

Check your Udemy login session and browser.

```bash
coupon-finder whoami
```

### `coupon-finder find [OPTIONS]`

Scrape coupons from all configured sources.

**Options:**
- `--pages N` — number of pages per source (default: from config)
- `--source NAME` — scrape specific source only (realdiscount, couponscorpion, udemyxpert, couponami)
- `--no-parallel` — run sequentially instead of in parallel

**Examples:**
```bash
coupon-finder find --pages 10
coupon-finder find --source realdiscount --pages 5
coupon-finder find --pages 3 --no-parallel
```

### `coupon-finder list`

Check your enrollment status for scraped courses.

```bash
coupon-finder list
```

Shows:
- Courses you can claim (not enrolled + valid coupon)
- Courses you already have
- Expired coupons

### `coupon-finder claim`

Auto-enroll in all claimable courses.

```bash
coupon-finder claim
```

**Options:**
- `--open` — open claimed course URLs in your browser (10 at a time)

### `coupon-finder config`

View or edit configuration.

```bash
# Show current config
coupon-finder config

# Update a setting
coupon-finder config --set pages=10
coupon-finder config --set browser=chrome
coupon-finder config --set parallel=false
coupon-finder config --set sources=realdiscount,udemyxpert,couponami
```

## Configuration

Config file: `~/.coupon-finder/config.json`

**Default:**
```json
{
  "pages": 1,
  "sources": ["realdiscount", "couponscorpion", "udemyxpert", "couponami"],
  "parallel": true,
  "browser": "firefox",
  "headless": true,
  "autoOpen": false,
  "expandCoupons": true,
  "resultsDir": "~/.coupon-finder/results"
}
```

**Fields:**
- `pages` — pages to scrape per source (default: 1)
- `sources` — array of sources to use
- `parallel` — run scrapers concurrently (default: true)
- `browser` — firefox, chrome, or brave
- `headless` — run browser headless (default: true)
- `autoOpen` — auto-open course URLs after claim (default: false)
- `expandCoupons` — discover instructor-wide coupons (default: true)
- `resultsDir` — where to save results

## How It Works

1. **Session extraction:** Reads your active browser's Udemy session cookies (Firefox, Chrome, or Brave)
2. **Multi-source scraping:** Launches Playwright browsers to scrape each coupon source in parallel
3. **Deduplication:** Merges results by course URL, keeping the best coupon code
4. **Enrollment checking:** Queries Udemy API to check which courses you already have
5. **Auto-enrollment:** Posts to Udemy's checkout API to enroll in courses with valid coupons
6. **Cleanup:** Deletes JSON result files older than 3 days

## Supported Browsers

- ✅ Firefox
- ✅ Chrome / Chromium
- ✅ Brave
- 🔜 Safari (future)

## Supported Coupon Sources

- ✅ **realdiscount.com** — React SPA, MUI pagination
- ✅ **couponscorpion.com** — Static HTML, URL params
- ✅ **udemyxpert.com** — Slug-based pagination
- ✅ **couponami.com** — Path-based pagination
- 🔜 More sources can be added as plugins

## Troubleshooting

### "Not logged in" error

Your browser session has expired. Log in to Udemy in Firefox/Chrome/Brave and try again:

```bash
# Open your browser and log in
firefox https://udemy.com

# Then try again
coupon-finder whoami
```

### Scraper timeouts

If a scraper is slow, it will retry up to 3 times with a 5-second timeout. If it still fails, the source is skipped with a warning.

### No courses found

Check:
1. Are you scraping the right pages? (`coupon-finder config` to see settings)
2. Do the sources have coupons? Try visiting them manually
3. Check the JSON results: `~/.coupon-finder/results/`

## Results & Logs

All results are saved to `~/.coupon-finder/results/`:

- `*_scrape.json` — Raw scrape output from each source
- `*_merged.json` — After dedup + best coupon kept
- `*_checked.json` — After enrollment checking
- `coupon-finder.log` — Application logs

Files older than 3 days are automatically deleted.

## Development

See [plans/](plans/) for implementation phases:

- [Phase 1: CLI Skeleton + Config](plans/phase-1.md)
- [Phase 2: Browser Plugin System](plans/phase-2.md)
- [Phase 3: Scraper Plugin System](plans/phase-3.md)
- [Phase 4: All Scrapers + Merge](plans/phase-4.md)
- [Phase 5: Enrollment Checking + Claiming](plans/phase-5.md)
- [Phase 6: Build & Distribution](plans/phase-6.md)

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon)

---

**Built with Bun & TypeScript**

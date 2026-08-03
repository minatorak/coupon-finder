# coupon-finder CLI

> **Find, check, and claim free Udemy courses from multiple coupon sources — all from one command.**

Coupon-finder is a command-line tool that automates discovering free Udemy courses from multiple coupon websites and auto-enrolls you via your Udemy account. Built with Bun & TypeScript for fast, single-binary distribution.

## Features

- 🔍 **Two-stage scraping:** Scrape source pages from realdiscount, couponscorpion, udemyxpert, and couponami, then resolve course pages with configurable concurrency
- 🔗 **Session-aware:** Reads your active Udemy browser session (Firefox, Chrome, Brave) to check enrollment status
- 📊 **Deduplication:** Automatically merges results by course URL, keeping the best coupon code
- 🚀 **Auto-enrollment:** Batch-enroll in courses with valid coupons
- ⚙️ **Configurable:** TOML config at `~/.coupon-finder/config.toml`
- 📦 **Self-contained:** Single executable, no Python or Node.js required
- 🧹 **Auto-cleanup:** Deletes result files older than 3 days

## Installation

The installer downloads a signed, platform-specific executable from GitHub
Releases. Bun is only needed for development; it is not required on the user's
machine.

Supported release targets:

- macOS Apple Silicon (`darwin-arm64`)
- macOS Intel (`darwin-x64`)
- Linux x64 (`linux-x64`)

Before installing, ensure `curl` and `openssl` are available, and install a
supported system browser (Firefox, Chrome, or Brave) with an active Udemy
session. Android/Termux, Windows, and Linux ARM64 are not supported yet.

```bash
curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/install.sh | bash
```

The installer places the executable at `~/.local/bin/coupon-finder`, adds that
directory to the detected zsh/bash startup file once, and never uses `sudo`.
Open a new terminal after installation, then verify:


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

This scrapes 5 pages from each source, opens course pages with configurable per-source concurrency, and merges results:
```
🔍 Scraping 4 sources in parallel with up to 4 course pages per source...
  ✅ realdiscount: 45 courses
  ✅ couponscorpion: 38 courses
  ✅ udemyxpert: 52 courses
  ✅ couponami: 29 courses
📊 Total: 164 courses (after dedup: 120)
💾 Saved to: ~/.coupon-finder/results/2026-06-18T120500Z_merged.json
```

### Run the full workflow

Run find, list, and claim in order with one command:

```bash
coupon-finder run --pages 5
```

`run` accepts every `find` option. It stops before claiming if this run has no
newly checked courses, so it never opens courses from an older result file.
With the Makefile, use `make run` to run the workflow with the configured
defaults.

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

### Global options

```bash
coupon-finder --help
coupon-finder --version
```

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
- `--parallel N` — maximum number of course pages to open at once per source
- `--source-parallel` — run sources in parallel
- `--no-source-parallel` — run sources sequentially instead of in parallel
- `--no-parallel` — alias for `--no-source-parallel`

**Examples:**
```bash
coupon-finder find --pages 10
coupon-finder find --source realdiscount --pages 5
coupon-finder find --pages 3 --no-source-parallel
coupon-finder find --parallel 6
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

Open eligible course pages in your browser so you can claim them.

```bash
coupon-finder claim
```

### `coupon-finder run [FIND OPTIONS]`

Run `find`, `list`, and `claim` sequentially. It accepts the same options as
`find` and only proceeds to `claim` when `list` saved newly checked results.

```bash
coupon-finder run --pages 5
coupon-finder run --source udemyxpert --parallel 2
```

### `coupon-finder update`

Check for and install a newer signed release. This command only works when
running the installed `~/.local/bin/coupon-finder` binary.

```bash
coupon-finder update
```

### `coupon-finder config`

View or edit configuration.

On the first run, the command asks for every setting and writes
`~/.coupon-finder/config.toml`. Later runs only ask whether you want to edit;
choosing no uses the saved values.

```bash
# Show current config
coupon-finder config

# Update a setting
coupon-finder config --set pages=10
coupon-finder config --set browser=chrome
coupon-finder config --set sourceParallel=false
coupon-finder config --set parallel=4
coupon-finder config --set sources=realdiscount,udemyxpert,couponami
```

## Configuration

Config file: `~/.coupon-finder/config.toml`

**Default:**
```toml
# Number of pages to scrape from each enabled coupon source.
pages = 1

# Coupon sources to scrape. Remove a source to skip it.
sources = ["realdiscount", "couponscorpion", "udemyxpert", "couponami"]

# Scrape all enabled sources at the same time.
sourceParallel = true

# Maximum course pages to open concurrently for each source.
parallel = 4

# Browser used to read your logged-in Udemy session.
browser = "firefox"

# Run the installed system browser without showing a window.
headless = true

# Look for instructor-wide coupons in addition to course-specific coupons.
expandCoupons = true

# Directory where scraped and checked course results are stored.
resultsDir = "~/.coupon-finder/results"
```

**Fields:**
- `pages` — pages to scrape per source (default: 1)
- `sources` — array of sources to use
- `sourceParallel` — run source scrapers concurrently (default: true)
- `parallel` — maximum course pages to open at once per source (default: 4)
- `browser` — firefox, chrome, or brave
- `headless` — run browser headless (default: true)
- `expandCoupons` — discover instructor-wide coupons (default: true)
- `resultsDir` — where to save results

## How It Works

1. **Session extraction:** Reads your active browser's Udemy session cookies (Firefox, Chrome, or Brave)
2. **Source-page scraping:** Opens each coupon source one page at a time and collects course-page links
3. **Course-page resolution:** Opens course pages with the configured `parallel` limit and extracts Udemy URLs plus coupon data
4. **Deduplication:** Merges results by course URL, keeping the best coupon code
5. **Enrollment checking:** Queries Udemy API to check which courses you already have
6. **Auto-enrollment:** Posts to Udemy's checkout API to enroll in courses with valid coupons
7. **Cleanup:** Deletes JSON result files older than 3 days

## Supported Browsers

- ✅ Firefox
- ✅ Chrome / Chromium
- ✅ Brave
- 🔜 Safari (future)

## Supported Coupon Sources

- ✅ **realdiscount.com** — React SPA, MUI buttons plus course pages
- ✅ **couponscorpion.com** — Source pages plus course pages
- ✅ **udemyxpert.com** — Slug-based source pages plus course pages
- ✅ **couponami.com** — Path-based source pages plus course pages
- 🔜 More sources can be added as plugins

## Troubleshooting

### Command not found after installation

Open a new terminal so the managed `~/.local/bin` PATH block is loaded. For an
unsupported shell, add this line to its startup file:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Unsupported platform or missing OpenSSL

The first release supports only macOS arm64/x64 and Linux x64. Install the
system `openssl` package and rerun the installer. Android/Termux and Linux
ARM64 are intentionally rejected.

### Invalid signature or checksum

The installer refuses to replace an existing binary when the signed manifest,
signature, or selected binary hash is invalid. Retry from the official install
command and investigate the release before bypassing verification.

### Missing browser

Install Firefox, Chrome, or Brave and log in to Udemy there. The application
does not download or manage browser binaries during installation.

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

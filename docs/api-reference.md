# coupon-finder API Reference

## CLI Commands

### coupon-finder whoami

Check your Udemy login session.

```bash
coupon-finder whoami
```

**Output:**
```
✅ Logged in as: John Doe
📧 Email: john@example.com
🌐 Browser: Firefox
✓ Session: valid
```

**Errors:**
- No Firefox/Chrome/Brave session found
- Session expired

---

### coupon-finder config

View or edit configuration.

```bash
# Show current config
coupon-finder config

# Update a setting
coupon-finder config --set key=value
```

**Settings:**
- `pages` (integer) — Pages to scrape per source (default: 1)
- `browser` (string) — firefox | chrome | brave (default: firefox)
- `sourceParallel` (boolean) — Run source scrapers concurrently (default: true)
- `parallel` (integer) — Max course pages open at once per source (default: 4)
- `headless` (boolean) — Run browser headless (default: true)
- `expandCoupons` (boolean) — Discover instructor-wide coupons (default: true)
- `sources` (array) — CSV of sources (default: all 4)
- `resultsDir` (string) — Directory for result files

**Examples:**
```bash
coupon-finder config --set pages=10
coupon-finder config --set browser=chrome
coupon-finder config --set sourceParallel=false
coupon-finder config --set parallel=4
coupon-finder config --set sources=realdiscount,udemyxpert,couponami
```

---

### coupon-finder find

Scrape coupons from configured sources.

```bash
coupon-finder find [OPTIONS]
```

**Options:**
- `--pages N` — Override pages per source
- `--source NAME` — Scrape specific source only
- `--parallel N` — Max course pages to open at once per source
- `--source-parallel` — Run sources in parallel
- `--no-source-parallel` — Run sources sequentially
- `--no-parallel` — Alias for `--no-source-parallel`

**Output:**
```
🔍 Scraping 4 sources in parallel with up to 4 course pages per source...
✅ realdiscount: 45 courses
✅ couponscorpion: 38 courses
✅ udemyxpert: 52 courses
✅ couponami: 29 courses
📊 Raw: 164 total courses
✨ Merged: 120 unique courses (deduplicated by URL)
```

**Results saved to:**
- `~/.coupon-finder/results/{timestamp}_scrape.json` — Raw courses
- `~/.coupon-finder/results/{timestamp}_merged.json` — Deduplicated

---

### coupon-finder list

Check enrollment status for scraped courses.

```bash
coupon-finder list
```

**Output:**
```
📋 Courses (checked against your Udemy account):
  ✅ 45 available (not enrolled, valid coupon)
  🔒 52 already enrolled
  ⚠️  23 expired coupons
```

**Results saved to:**
- `~/.coupon-finder/results/{timestamp}_checked.json`

---

### coupon-finder claim

Auto-enroll in all claimable courses.

```bash
coupon-finder claim [OPTIONS]
```

**Options:**
- `--open` — Open claimed course URLs in browser (10 at a time, press Enter between batches)

**Output:**
```
🚀 Claiming 45 courses...
✅ Claimed 44/45
❌ Failed: 1

📱 Batch 1/5 (10 URLs)
  ✓ https://udemy.com/course/python-basics/
  ✓ https://udemy.com/course/javascript-101/
  ... (8 more URLs)

Press Enter to open next batch (10 URLs)...
```

**Results saved to:**
- `~/.coupon-finder/results/claim_report_{timestamp}.json`

**Examples:**
```bash
# Claim without opening URLs
coupon-finder claim

# Claim and open URLs in batches
coupon-finder claim --open
```

---

### coupon-finder update

Check for and install new versions interactively.

```bash
coupon-finder update
```

**Output:**
```
ℹ️  Current version: v0.2.1

📦 Available Versions:

  [1] v0.2.2  (26.0MB, 2026-08-10)
  [2] v0.2.1  (25.9MB, 2026-08-04)

Enter number to select (1-3): 1
ℹ️  Selected: v0.2.2
Downloading coupon-finder-darwin-x64.tar.gz...
Downloaded coupon-finder-darwin-x64.tar.gz: 25.90MB in 3.2s
ℹ️  Verifying checksum...
✓ Checksum verified
✅ Updated successfully!
   v0.2.1 → v0.2.2
   Current: ~/.local/share/coupon-finder/releases/0.2.2-darwin-x64-<hash>
```

**Features:**
- Interactive version selection (numbered menu)
- Supports downgrading to older versions
- SHA256 checksum verification
- Signed archive and release metadata validation
- Staged and post-switch `--release-smoke` checks
- Atomic `current` symlink replacement with rollback on failed smoke
- Immediate old-release cleanup after success; no retained backup
- Concurrency guard (prevents parallel updates)

**Errors:**
- "No compatible releases found" — the release has no archive for this target
- "Update already in progress" — Another update is running (10-minute timeout)
- "No write permission" — Install root is not writable; do not use `sudo`
- "Checksum mismatch" — Downloaded file corrupted (automatic retry)
- "Already on vX.Y.Z" — Already on selected version (no-op)

**Supported Platforms:**
- ✅ macOS Intel (darwin-x64)
- ✅ macOS Apple Silicon (darwin-arm64)
- ✅ Linux x86_64 (linux-x64)
- ❌ Windows (not supported; reinstall from source)

Every new invocation follows `current`, so update does not require a shell
restart. Legacy single-binary layouts should try update once, then use
`uninstall.sh --yes` and reinstall if update reports an unsupported layout.

### Distribution maintenance interfaces

`coupon-finder --release-smoke` is an internal, network-free validation that
loads packaged Playwright and resolves Firefox and Chromium metadata. The
installer and updater invoke it automatically.

Clean uninstall supports `--help` and `--yes` only:

```bash
curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/uninstall.sh | bash
curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/uninstall.sh | bash -s -- --yes
```

It removes application-owned installs, data, results, logs, browser cache, and
managed PATH blocks. External `resultsDir` directories and legacy shared
Playwright caches are reported but never deleted automatically.

---

## Configuration File

**Location:** `~/.coupon-finder/config.toml`

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

---

## Results Files

**Location:** `~/.coupon-finder/results/`

**File types:**
- `*_scrape.json` — Raw course data from each source
- `*_merged.json` — After deduplication and URL normalization
- `*_checked.json` — After enrollment status check
- `claim_report_*.json` — Claim operation report
- `coupon-finder.log` — Application logs

**Course object:**
```typescript
{
  udemyUrl: string               // Canonical Udemy course URL and dedupe key
  title: string
  instructor?: string
  couponCodes: string[]          // All found coupon codes
  discount?: number              // Best discount %
  price?: number
  originalPrice?: number
  sourceType: "realdiscount" | "couponscorpion" | "udemyxpert" | "couponami"
  url?: string                   // Legacy alias for udemyUrl
  source?: "realdiscount" | "couponscorpion" | "udemyxpert" | "couponami"
  scrapedAt: string              // ISO timestamp
  enrolled?: boolean
  claimable?: boolean
  claimError?: string
}
```

---

## Typical Workflow

```bash
# 1. Verify login
coupon-finder whoami

# 2. Configure (optional)
coupon-finder config --set pages=5

# 3. Scrape all sources
coupon-finder find

# 4. Check enrollment
coupon-finder list

# 5. Auto-claim
coupon-finder claim

# 6. View report
cat ~/.coupon-finder/results/claim_report_*.json
```

---

## Exit Codes

- `0` — Success
- `1` — Error (invalid command, failed operation)

---

## Supported Coupon Sources

| Source | Type | Source / course pages | Status |
|--------|------|----------------------|--------|
| realdiscount.com | React SPA | MUI buttons + course pages | ✅ |
| couponscorpion.com | Static HTML | URL params + course pages | ✅ |
| udemyxpert.com | Dynamic | Slug-based + course pages | ✅ |
| couponami.com | Dynamic | Path-based + course pages | ✅ |

---

## Rate Limiting

- Each scraper retries 3x on failure
- 5-second timeout per scrape attempt
- No explicit rate limiting (respects HTTP 429)

---

## Troubleshooting

**"Not logged in" error:**
```bash
# Open your browser and log in to Udemy
firefox https://udemy.com
# Then try again
coupon-finder whoami
```

**No courses found:**
1. Check config: `coupon-finder config`
2. Try specific source: `coupon-finder find --source realdiscount --pages 1`
3. Check results: `ls ~/.coupon-finder/results/`

**Scraper timeout:**
- Automatically retries 3x
- If still failing, run sequentially: `coupon-finder find --no-source-parallel`

**Enrollment check fails:**
- Verify session is still valid: `coupon-finder whoami`
- Check internet connection
- Try again later

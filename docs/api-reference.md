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
- `parallel` (boolean) — Run scrapers concurrently (default: true)
- `headless` (boolean) — Run browser headless (default: true)
- `autoOpen` (boolean) — Auto-open URLs after claim (default: false)
- `expandCoupons` (boolean) — Discover instructor-wide coupons (default: true)
- `sources` (array) — CSV of sources (default: all 4)

**Examples:**
```bash
coupon-finder config --set pages=10
coupon-finder config --set browser=chrome
coupon-finder config --set parallel=false
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
- `--no-parallel` — Run sequentially

**Output:**
```
🔍 Scraping 4 sources (parallel)...
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
ℹ️  Current version: v0.1.0

📦 Available Versions:

  [1] v0.2.0  (15.2MB, 2026-06-20)
  [2] v0.1.1  (15.1MB, 2026-06-18)
  [3] v0.1.0  (15.0MB, 2026-06-15)

Enter number to select (1-3): 1
ℹ️  Selected: v0.2.0
Downloading coupon-finder-darwin-x64...
Downloaded coupon-finder-darwin-x64: 15.20MB in 3.2s
ℹ️  Verifying checksum...
✓ Checksum verified
✅ Updated successfully!
   v0.1.0 → v0.2.0
   Location: /usr/local/bin/coupon-finder
   Backup: /usr/local/bin/coupon-finder.backup-1718918400000.bak

⚠️  Restart your shell to use the new version:
   exec $SHELL
```

**Features:**
- Interactive version selection (numbered menu)
- Supports downgrading to older versions
- SHA256 checksum verification
- Atomic binary replacement with backup
- Automatic backup cleanup (keeps latest only)
- Concurrency guard (prevents parallel updates)

**Errors:**
- "No compatible releases found" — Phase 6 CI/CD must upload binaries + checksums
- "Update already in progress" — Another update is running (10-minute timeout)
- "No write permission" — Install directory not writable (try with `sudo`)
- "Checksum mismatch" — Downloaded file corrupted (automatic retry)
- "Already on vX.Y.Z" — Already on selected version (no-op)

**Supported Platforms:**
- ✅ macOS Intel (darwin-x64)
- ✅ macOS Apple Silicon (darwin-arm64)
- ✅ Linux x86_64 (linux-x64)
- ❌ Windows (not supported; reinstall from source)

**Shell restart required:**
After updating, restart your shell to load the new binary:
```bash
exec $SHELL
```

**Permission denied:**
If you see a permission error, run with `sudo`:
```bash
sudo coupon-finder update
```

---

## Configuration File

**Location:** `~/.coupon-finder/config.json`

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
  url: string                    // Unique Udemy course URL
  title: string
  instructor?: string
  couponCodes: string[]          // All found coupon codes
  discount?: number              // Best discount %
  price?: number
  originalPrice?: number
  source: "realdiscount" | "couponscorpion" | "udemyxpert" | "couponami"
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

| Source | Type | Pagination | Status |
|--------|------|-----------|--------|
| realdiscount.com | React SPA | MUI buttons | ✅ |
| couponscorpion.com | Static HTML | URL params | ✅ |
| udemyxpert.com | Dynamic | Slug-based | ✅ |
| couponami.com | Dynamic | Path-based | ✅ |

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
- If still failing, run sequentially: `coupon-finder find --no-parallel`

**Enrollment check fails:**
- Verify session is still valid: `coupon-finder whoami`
- Check internet connection
- Try again later

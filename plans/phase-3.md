# Phase 3: Scraper Plugin System + First Scraper

**Estimated Time:** 3 hours
**Goal:** Implement realdiscount scraper as pilot
**Depends On:** Phase 1-2

---

## Tasks

### 1. Scraper Interface
- [ ] Create `src/plugins/scrapers/base.ts` (ScraperPlugin interface)

### 2. Playwright Setup
- [ ] Create `src/utils/browser.ts` (launch with headless, images off)

### 3. Retry Logic
- [ ] Create `src/utils/retry.ts` (3x attempts, 5s max)

### 4. Results Storage
- [ ] Create `src/storage/results.ts` (save/load JSON)

### 5. Realdiscount Scraper
- [ ] Create `src/plugins/scrapers/realdiscount.ts` (port from .robot)

### 6. Find Command
- [ ] Create `src/commands/find.ts` (scrape + save)

### 7. Testing
- [ ] Test scraper (1 page)
- [ ] Test retry behavior
- [ ] Test JSON save

---

## Success Criteria

✅ `coupon-finder find --source realdiscount --pages 1` works
✅ Results saved with timestamps
✅ Retry logic functional

---

## Next Phase

→ Phase 4: All scrapers + merge

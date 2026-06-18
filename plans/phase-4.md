# Phase 4: All Scrapers + Merge Logic

**Estimated Time:** 3 hours
**Goal:** Support all 4 sources, dedup by URL, collect all coupon codes (sorted by discount)
**Depends On:** Phase 3

---

## Tasks

### 1. Remaining Scrapers
- [ ] Create `src/plugins/scrapers/couponscorpion.ts`
- [ ] Create `src/plugins/scrapers/udemyxpert.ts`
- [ ] Create `src/plugins/scrapers/discudemy.ts`

### 2. Merge Logic
- [ ] Create `src/merge/merger.ts` (dedup by URL, collect all coupon codes, sort by discount)

### 3. Parallel Scraping
- [ ] Update `src/commands/find.ts` to support `--parallel` and `--no-parallel`

### 4. Cleanup
- [ ] Create `src/storage/cleanup.ts` (delete files older than 3 days)
- [ ] Call cleanup on each run

### 5. Testing
- [ ] Test all 4 scrapers
- [ ] Test parallel vs sequential
- [ ] Test merge + dedup

---

## Success Criteria

✅ All 4 scrapers working
✅ `coupon-finder find --pages 5 --parallel` works
✅ Results merged with all coupon codes collected, best discount listed first
✅ Old files cleaned up automatically

---

## Next Phase

→ Phase 5: Enrollment checking + claiming

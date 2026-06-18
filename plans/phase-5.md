# Phase 5: Enrollment Checking + Auto-Claim

**Estimated Time:** 2-3 hours
**Goal:** Check enrollment, display claimable courses, auto-enroll
**Depends On:** Phase 4

---

## Tasks

### 1. Enrollment Logic
- [ ] Create `src/udemy/enrollment.ts` (check + claim via Udemy API)

### 2. List Command
- [ ] Create `src/commands/list.ts` (show checked courses with summary)

### 3. Claim Command
- [ ] Create `src/commands/claim.ts` (auto-enroll in courses)

### 4. Coupon Expansion (Optional)
- [ ] Create `src/merge/expander.ts` (discover instructor-wide coupons)
- [ ] Test coupon expansion logic

### 5. Open Flag
- [ ] Add `--open` flag to auto-open claimed courses in browser

### 6. Testing
- [ ] Test list command
- [ ] Test claim command
- [ ] Test coupon expansion (optional)

---

## Success Criteria

✅ `coupon-finder list` shows enrolled/claimable/expired courses
✅ `coupon-finder claim` auto-enrolls and reports results
✅ `--open` flag opens claimed courses in browser
✅ Optional: coupon expansion works

---

## Next Phase

→ Phase 6: Build & distribution (single binary + installer)

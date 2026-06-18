# Phase 2: Browser Plugin System

**Estimated Time:** 2 hours
**Goal:** Support Firefox, Chrome, Brave cookie extraction
**Depends On:** Phase 1

---

## Overview

Make browser support pluggable:
- Abstract browser interface (BrowserPlugin)
- Implement Firefox, Chrome, Brave plugins
- Update `whoami` to use selected browser

---

## Tasks

### 1. Plugin Registry
- [ ] Create `src/plugins/registry.ts` (PluginRegistry class)

### 2. Browser Interface
- [ ] Create `src/plugins/browsers/base.ts` (BrowserPlugin interface)

### 3. Browser Implementations
- [ ] Create `src/plugins/browsers/firefox.ts`
- [ ] Create `src/plugins/browsers/chrome.ts`
- [ ] Create `src/plugins/browsers/brave.ts`

### 4. Update whoami
- [ ] Modify `src/commands/whoami.ts` to use browser plugins

### 5. Testing
- [ ] Test each browser cookie extraction
- [ ] Test browser fallback behavior

---

## Success Criteria

✅ `coupon-finder whoami` works for Firefox
✅ `coupon-finder whoami` works for Chrome (if installed)
✅ `coupon-finder whoami` works for Brave (if installed)
✅ Browser plugins are extensible

---

## Next Phase

→ Phase 3: Scraper plugin system + first scraper

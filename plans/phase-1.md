# Phase 1: CLI Skeleton + Config System + whoami Command

**Estimated Time:** 2-3 hours
**Goal:** Working CLI that checks Udemy login and shows configuration
**Status:** Ready to start

---

## Overview

Phase 1 sets up the foundational CLI structure:
- Initialize Bun project with TypeScript
- Create config system (load/save `~/.coupon-finder/config.json`)
- Implement `whoami` command (validate Udemy session)
- Implement `config` command (show + `--set`)

---

## Deliverables

```bash
bun run src/cli.ts whoami
bun run src/cli.ts config
bun run src/cli.ts config --set pages=10
```

---

## Tasks

### 1. Project Setup
- [ ] Initialize Bun project (package.json, tsconfig.json, bunfig.toml)
- [ ] Install: `playwright`, `better-sqlite3`

### 2. Type Definitions
- [ ] Create `src/types.ts` (Course, Config, BrowserPlugin, ScraperPlugin)

### 3. Directory Structure
- [ ] Create `src/utils/paths.ts` (config dir constants)

### 4. Config System
- [ ] Create `src/config.ts` (loadConfig, saveConfig, updateField)

### 5. Udemy Session
- [ ] Create `src/udemy/session.ts` (getFirefoxCookies)

### 6. Udemy API
- [ ] Create `src/udemy/api.ts` (createSession, getCurrentUser)

### 7. Commands
- [ ] Create `src/commands/whoami.ts`
- [ ] Create `src/commands/config-cmd.ts`

### 8. Utilities
- [ ] Create `src/utils/logger.ts`

### 9. CLI Entry
- [ ] Create `src/cli.ts` (command routing)

### 10. Testing
- [ ] Create `tests/config.test.ts`
- [ ] Manual test: whoami, config commands

---

## Success Criteria

✅ `bun run src/cli.ts whoami` validates Udemy session
✅ `bun run src/cli.ts config` shows/updates settings
✅ Config auto-created at `~/.coupon-finder/config.json`
✅ Ready for Phase 2

---

## Next Phase

→ Phase 2: Browser plugin system (Firefox, Chrome, Brave)

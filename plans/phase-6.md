# Phase 6: Build & Distribution

**Estimated Time:** 2 hours
**Goal:** Single executable + curl|bash installer
**Depends On:** Phases 1-5

---

## Tasks

### 1. Bun Build Configuration
- [ ] Set up `bun build --compile` command
- [ ] Test single executable generation
- [ ] Verify size (~80MB)

### 2. GitHub Releases
- [ ] Create GitHub Actions workflow for auto-build on release
- [ ] Test release creation

### 3. Installer Script
- [ ] Create `install.sh` (curl | bash installer)
- [ ] Download latest binary from GitHub releases
- [ ] Install to `/usr/local/bin/coupon-finder`
- [ ] Make executable

### 4. Documentation
- [ ] Create `docs/installation.md`
- [ ] Create `docs/usage.md` (all commands)
- [ ] Update main `README.md`

### 5. Testing
- [ ] Test installer: `curl -fsSL ... | bash`
- [ ] Test all commands work from installed binary
- [ ] Test version flag: `coupon-finder --version`

### 6. Release
- [ ] Create GitHub release with binary attachment
- [ ] Publish

---

## Success Criteria

✅ Single executable compiled with Bun
✅ `curl -fsSL github.com/minatorak/coupon-finder/install.sh | bash` works
✅ `coupon-finder --help` and all commands work
✅ Installation documented

---

## Distribution

User flow:
```bash
curl -fsSL github.com/minatorak/coupon-finder/install.sh | bash
coupon-finder whoami
coupon-finder find --pages 5
coupon-finder claim
```

---

## After Phase 6

- ✅ Full product complete
- User testing & refinement
- Open-source if desired

# Makefile Guide — coupon-finder

The Makefile provides convenient commands for developing, testing, and running coupon-finder locally.

## Quick Start

```bash
make help              # Show all available commands
make setup-dev        # Install dependencies
make type-check       # Verify TypeScript types
make find-fast        # Quick test: scrape 1 source, 1 page
```

---

## Command Categories

### Setup & Installation

```bash
make install          # Install dependencies (bun install)
make clean            # Remove node_modules, build artifacts, results
make setup-dev        # One-time setup for development
```

### Development Commands

```bash
make dev              # Run CLI in dev mode (interactive)
make whoami           # Check if you're logged into Udemy
make config           # View current configuration
make config-set       # Set a config value (usage help)
```

**Example:**
```bash
make whoami
# Output: ✅ Logged in as: John Doe
```

---

### Scraping Commands

```bash
make find             # Find courses (1 page, source parallel, 4 concurrent course pages)
make find-fast        # Quick test (1 source, 1 page)
make find-all         # Scrape all sources (5 pages)
make find-sequential  # Scrape sources sequentially (lower memory)
make list             # Check enrollment status
make claim            # Auto-claim courses
```

The find command uses a **two-phase scrape model**:
1. **Source pages** — scrape coupon listing pages for course seeds (title + link)
2. **Course page resolution** — open each seed's link with bounded concurrency (`parallel: N`) to resolve the actual Udemy URL and extract coupon codes

**Example Workflow:**
```bash
make whoami           # Verify login first
make find-fast        # Test with 1 source
make find             # Scrape all sources (1 page)
make list             # Check what you can claim
make claim            # Auto-enroll
```

---

### Testing & Quality

```bash
make type-check       # TypeScript strict type checking
make test             # Run test suite (when tests exist)
make lint             # Show ESLint setup instructions
make health-check     # Full health check (types + CLI)
```

**Example:**
```bash
make type-check
# ✅ Type check passed

make health-check
# ✓ TypeScript types OK
# ✓ CLI runs
# ✅ Health check complete
```

---

### Building & Distribution

```bash
make build            # Build bundled code
make dist             # Create distribution files
```

---

### Information & Debugging

```bash
make logs             # Show latest application logs
make results          # Display latest results files
make sources          # List available coupon sources
make config-help      # Show all config options
make stats            # Show project statistics
make debug            # Run with debug logging
make reset-config     # Reset config to defaults
```

**Example:**
```bash
make stats
# Project Statistics:
#   TypeScript files:       26
#   Lines of code: 1661
#   Documentation files:        2
#   Config files:        3

make results
# Latest file: ~/.coupon-finder/results/20260618T120500Z_merged.json
# First 5 courses:
# [
#   {"url": "https://www.udemy.com/course/...", "title": "...", ...},
#   ...
# ]
```

---

### Workflow Shortcuts

```bash
make workflow-quick       # Quick test: whoami + find-fast
make workflow-full        # Full workflow: whoami + find + list
make workflow-full-claim  # Full workflow with claim
```

**Example:**
```bash
make workflow-quick
# Runs: make whoami && make find-fast
# Outputs complete test in ~30 seconds
```

---

## Configuration via Make

### Direct Config Updates

```bash
# Using config command (3 ways):
make config                           # View current
bun run src/cli.ts config --set pages=10
bun run src/cli.ts config --set browser=chrome
bun run src/cli.ts config --set sourceParallel=false
bun run src/cli.ts config --set parallel=4
```

### Available Config Options

```bash
make config-help

# Output:
# Configuration Options:
#   pages          - Pages to scrape per source (default: 1)
#   browser        - firefox | chrome | brave (default: firefox)
#   sourceParallel - true | false (default: true) — run source scrapers concurrently
#   parallel       - integer max course pages open per source (default: 4)
#   headless       - true | false (default: true)
#   autoOpen       - true | false (default: false)
#   expandCoupons  - true | false (default: true)
```

**Note:** The old `parallel` config (boolean, for source parallelism) has been replaced by `sourceParallel` (boolean) + `parallel` (integer for course page concurrency). Old configs with `"parallel": true/false` are auto-migrated on first load.

---

## Typical Development Workflows

### First-Time Setup

```bash
make setup-dev        # Install everything
make whoami           # Verify login
make find-fast        # Quick test
```

### Daily Development

```bash
make type-check       # Verify code
make config           # Check settings
make find-fast        # Quick scrape
make results          # See results
```

### Full Testing Cycle

```bash
make health-check     # Full health check
make workflow-full    # Complete workflow (no claim)
make type-check       # Type safety
```

### Before Committing

```bash
make type-check       # Must pass
make health-check     # Final check
make stats            # Show project state
```

---

## Advanced Usage

### Debug Mode

```bash
make debug
# Runs with DEBUG=1 (verbose logging)
```

### Viewing Results

```bash
make results

# Shows:
# - Latest result files
# - File sizes and timestamps
# - First 5 courses from latest file
# - Pretty-printed JSON
```

### Viewing Logs

```bash
make logs

# Shows last 50 lines of:
# ~/.coupon-finder/results/coupon-finder.log
```

### Reset Everything

```bash
make clean            # Remove all build artifacts
make reset-config     # Reset config to defaults
make setup-dev        # Reinstall everything
```

---

## Environment Variables

The Makefile respects these environment variables:

```bash
DEBUG=1 make find         # Run with debug logging
```

---

## Makefile Targets Reference

| Target | Purpose | Time |
|--------|---------|------|
| `help` | Show all targets | - |
| `setup-dev` | First-time setup | 30s |
| `install` | Install dependencies | 30s |
| `clean` | Remove artifacts | 5s |
| `whoami` | Check login | 2s |
| `config` | View/edit config | 1s |
| `find-fast` | Quick 1-source test | 30s |
| `find` | Scrape all (1 page) | 60s |
| `find-all` | Scrape all (5 pages) | 5m |
| `list` | Check enrollment | 2m |
| `claim` | Auto-claim | Variable |
| `type-check` | Type checking | 5s |
| `test` | Run tests | - |
| `build` | Build code | 10s |
| `health-check` | Full health check | 10s |
| `logs` | Show logs | 1s |
| `results` | Show results | 1s |
| `stats` | Project stats | 1s |

---

## Troubleshooting

### "make: command not found"
Install make:
```bash
# macOS
brew install make

# Ubuntu
sudo apt-get install build-essential
```

### Target fails silently
Add `@echo` for debugging:
```bash
make find 2>&1 | head -20
```

### View raw Makefile
```bash
cat Makefile
```

### Create custom target
Edit `Makefile` and add:
```makefile
my-task:
	@echo "Running my task..."
	bun run src/cli.ts find --pages 3
```

Then run:
```bash
make my-task
```

---

## Color Output

The Makefile uses colored output for clarity:

- 🔵 **Blue** — Section headers, current task
- 🟢 **Green** — Success messages, commands to run
- 🟡 **Yellow** — Warnings, instructions

To disable colors:
```bash
# Edit Makefile and comment out color lines:
# BLUE := \033[0;34m
# GREEN := \033[0;32m
# YELLOW := \033[0;33m
```

---

## Examples

### Scrape and Check

```bash
$ make find
$ make list

Output:
📋 Courses (checked against your Udemy account):
  ✅ 45 available (not enrolled, valid coupon)
  🔒 52 already enrolled
  ⚠️  23 expired coupons
```

### View Latest Results

```bash
$ make results

Output:
-rw-r--r--  user  staff  45678 Jun 18 12:05 20260618T120500Z_merged.json
Latest file: ~/.coupon-finder/results/20260618T120500Z_merged.json
First 5 courses:
[
  {
    "url": "https://www.udemy.com/course/python-course/",
    "title": "Python for Beginners",
    "discount": 100,
    ...
  },
  ...
]
```

### Full Workflow

```bash
$ make workflow-full
$ cat ~/.coupon-finder/results/claim_report_*.json
```

---

## Next Steps

After running `make setup-dev`:

1. **Test login:** `make whoami`
2. **Quick scrape:** `make find-fast`
3. **Check results:** `make results`
4. **View enrollment:** `make list`
5. **Read docs:** Open `README.md` or `docs/api-reference.md`

---

## See Also

- `README.md` — User guide
- `PLAN.md` — Architecture details
- `docs/api-reference.md` — CLI commands
- `CONTRIBUTING.md` — Development guide

---

**Built for:** Local development and testing
**Updated:** 2026-06-18

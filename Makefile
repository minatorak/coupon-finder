.PHONY: help install dev test lint type-check build clean whoami config find list claim update

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help:
	@echo "$(BLUE)coupon-finder Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Setup:$(NC)"
	@echo "  make install          Install dependencies"
	@echo "  make clean            Remove node_modules and build artifacts"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev              Run CLI in development mode"
	@echo "  make whoami           Check Udemy login"
	@echo "  make config           View/edit configuration"
	@echo ""
	@echo "$(GREEN)Scraping:$(NC)"
	@echo "  make find             Find courses (default: 1 page)"
	@echo "  make find-fast        Find 1 source (realdiscount)"
	@echo "  make find-all         Find all sources, 5 pages"
	@echo "  make list             Check enrollment status"
	@echo "  make claim            Auto-claim courses"
	@echo ""
	@echo "$(GREEN)Updates:$(NC)"
	@echo "  make update           Check for and install updates"
	@echo ""
	@echo "$(GREEN)Testing & Quality:$(NC)"
	@echo "  make type-check       TypeScript type checking"
	@echo "  make test             Run all tests"
	@echo "  make lint             Lint code (lint-ready)"
	@echo ""
	@echo "$(GREEN)Building:$(NC)"
	@echo "  make build            Build bundled code"
	@echo "  make dist             Create distribution files"
	@echo ""
	@echo "$(GREEN)Advanced:$(NC)"
	@echo "  make debug            Run with debug logging"
	@echo "  make logs             Show application logs"
	@echo "  make results          Show latest results"
	@echo "  make reset-config     Reset to default config"

install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	bun install

clean:
	@echo "$(BLUE)Cleaning up...$(NC)"
	rm -rf node_modules dist build *.log
	rm -rf ~/.coupon-finder/results/*
	@echo "$(GREEN)Clean complete$(NC)"

dev:
	@echo "$(BLUE)Running coupon-finder (dev mode)$(NC)"
	bun run src/cli.ts

whoami:
	@echo "$(BLUE)Checking Udemy login...$(NC)"
	bun run src/cli.ts whoami

config:
	@echo "$(BLUE)Showing configuration...$(NC)"
	bun run src/cli.ts config

config-set:
	@echo "$(YELLOW)Usage: make config-set KEY=VALUE$(NC)"
	@echo "Example: make config-set PAGES=10"
	@echo "Example: make config-set BROWSER=chrome"

find:
	@echo "$(BLUE)Finding courses (1 page, parallel)...$(NC)"
	bun run src/cli.ts find --pages 1

find-fast:
	@echo "$(BLUE)Quick test: Scraping realdiscount (1 page)...$(NC)"
	bun run src/cli.ts find --source realdiscount --pages 1

find-all:
	@echo "$(BLUE)Finding all courses (5 pages, parallel)...$(NC)"
	bun run src/cli.ts find --pages 5

find-sequential:
	@echo "$(BLUE)Finding courses (sequential mode, lower memory)...$(NC)"
	bun run src/cli.ts find --pages 1 --no-parallel

list:
	@echo "$(BLUE)Checking enrollment status...$(NC)"
	bun run src/cli.ts list

claim:
	@echo "$(BLUE)Auto-claiming courses...$(NC)"
	bun run src/cli.ts claim

update:
	@echo "$(BLUE)Checking for updates...$(NC)"
	bun run src/cli.ts update

type-check:
	@echo "$(BLUE)Type checking...$(NC)"
	bun run tsc --noEmit
	@echo "$(GREEN)✅ Type check passed$(NC)"

test:
	@echo "$(BLUE)Running tests...$(NC)"
	bun test
	@echo "$(GREEN)✅ Tests complete$(NC)"

lint:
	@echo "$(YELLOW)Lint-ready (install ESLint to lint)$(NC)"
	@echo "  npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin"
	@echo "  npx eslint src/"

build:
	@echo "$(BLUE)Building...$(NC)"
	bun run build
	@echo "$(GREEN)✅ Build complete$(NC)"

dist:
	@echo "$(BLUE)Creating distribution files...$(NC)"
	mkdir -p dist
	cp -r src dist/
	cp -r node_modules dist/ 2>/dev/null || true
	cp package.json dist/
	cp tsconfig.json dist/
	@echo "$(GREEN)✅ Distribution files created in dist/$(NC)"

debug:
	@echo "$(BLUE)Running with debug logging...$(NC)"
	DEBUG=1 bun run src/cli.ts

logs:
	@echo "$(BLUE)Application logs:$(NC)"
	@if [ -f ~/.coupon-finder/results/coupon-finder.log ]; then \
		tail -50 ~/.coupon-finder/results/coupon-finder.log; \
	else \
		echo "$(YELLOW)No logs found yet$(NC)"; \
	fi

results:
	@echo "$(BLUE)Latest results:$(NC)"
	@if [ -d ~/.coupon-finder/results ]; then \
		ls -ltr ~/.coupon-finder/results/ | tail -5; \
		echo ""; \
		latest=$$(ls -t ~/.coupon-finder/results/*.json 2>/dev/null | head -1); \
		if [ -n "$$latest" ]; then \
			echo "$(BLUE)Latest file: $$latest$(NC)"; \
			echo "$(BLUE)First 5 courses:$(NC)"; \
			jq '.[0:5]' "$$latest" 2>/dev/null || cat "$$latest"; \
		fi; \
	else \
		echo "$(YELLOW)No results directory found. Run 'make find' first.$(NC)"; \
	fi

reset-config:
	@echo "$(YELLOW)Resetting config to defaults...$(NC)"
	rm -f ~/.coupon-finder/config.json
	bun run src/cli.ts config
	@echo "$(GREEN)✅ Config reset$(NC)"

# Advanced targets
workflow-quick: whoami find-fast
	@echo "$(GREEN)✅ Quick workflow complete$(NC)"

workflow-full: whoami find list
	@echo "$(GREEN)✅ Full workflow complete$(NC)"

workflow-full-claim: whoami find list claim
	@echo "$(GREEN)✅ Full workflow with claim complete$(NC)"

# Development helpers
setup-dev: install
	@echo "$(BLUE)Setting up development environment...$(NC)"
	@echo "$(GREEN)✅ Ready for development$(NC)"
	@echo "Run: $(BLUE)make find-fast$(NC) to test"

# Show available sources
sources:
	@echo "$(BLUE)Available coupon sources:$(NC)"
	@echo "  $(GREEN)realdiscount$(NC)     - React SPA (MUI pagination)"
	@echo "  $(GREEN)couponscorpion$(NC)   - Static HTML"
	@echo "  $(GREEN)udemyxpert$(NC)       - Slug-based pagination"
	@echo "  $(GREEN)discudemy$(NC)        - Path-based pagination"
	@echo ""
	@echo "Test specific source:"
	@echo "  $(BLUE)bun run src/cli.ts find --source realdiscount --pages 1$(NC)"

# Show config options
config-help:
	@echo "$(BLUE)Configuration Options:$(NC)"
	@echo ""
	@echo "  $(GREEN)pages$(NC)          - Pages to scrape per source (default: 1)"
	@echo "  $(GREEN)browser$(NC)        - firefox | chrome | brave (default: firefox)"
	@echo "  $(GREEN)parallel$(NC)       - true | false (default: true)"
	@echo "  $(GREEN)headless$(NC)       - true | false (default: true)"
	@echo "  $(GREEN)autoOpen$(NC)       - true | false (default: false)"
	@echo "  $(GREEN)expandCoupons$(NC)  - true | false (default: true)"
	@echo ""
	@echo "Examples:"
	@echo "  $(BLUE)make config-set pages=10$(NC)"
	@echo "  $(BLUE)bun run src/cli.ts config --set browser=chrome$(NC)"
	@echo "  $(BLUE)bun run src/cli.ts config --set parallel=false$(NC)"

# Health check
health-check: type-check
	@echo "$(BLUE)Running health check...$(NC)"
	@echo "  $(GREEN)✓$(NC) TypeScript types OK"
	@bun run src/cli.ts --version > /dev/null && echo "  $(GREEN)✓$(NC) CLI runs" || echo "  $(RED)✗$(NC) CLI failed"
	@echo "$(GREEN)✅ Health check complete$(NC)"

# Show statistics
stats:
	@echo "$(BLUE)Project Statistics:$(NC)"
	@echo "  TypeScript files: $$(find src -name '*.ts' | wc -l)"
	@echo "  Lines of code: $$(find src -name '*.ts' -exec wc -l {} + | tail -1 | awk '{print $$1}')"
	@echo "  Documentation files: $$(find docs -name '*.md' 2>/dev/null | wc -l)"
	@echo "  Config files: $$(find . -maxdepth 1 -name '*.json' -o -name '*.toml' | wc -l)"

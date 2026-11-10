.DEFAULT_GOAL := help

CLI := bun run src/cli.ts
RELEASE_TARGET ?= $(shell uname -s | tr '[:upper:]' '[:lower:]')-$(shell uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')

.PHONY: help install dev cli-help version whoami config find list claim run update \
	type-check test build build-release find-fast results

help:
	@printf '%s\n' 'coupon-finder Makefile'
	@printf '%s\n' ''
	@printf '%s\n' 'CLI commands:'
	@printf '%s\n' '  make cli-help    Show CLI usage'
	@printf '%s\n' '  make version     Show CLI version'
	@printf '%s\n' '  make whoami      Check the Udemy session'
	@printf '%s\n' '  make config      Create, view, or edit configuration'
	@printf '%s\n' '  make find        Scrape configured coupon sources'
	@printf '%s\n' '  make list        Check enrollment for scraped courses'
	@printf '%s\n' '  make claim       Open eligible course pages to claim'
	@printf '%s\n' '  make run         Run find, list, then claim in sequence'
	@printf '%s\n' '  make update      Check for and install updates'
	@printf '%s\n' ''
	@printf '%s\n' 'Development:'
	@printf '%s\n' '  make install     Install Bun dependencies'
	@printf '%s\n' '  make dev         Run the CLI without a command'
	@printf '%s\n' '  make type-check  Run TypeScript checks'
	@printf '%s\n' '  make test        Run the test suite'
	@printf '%s\n' '  make build       Create the native release executable'
	@printf '%s\n' '  make build-release RELEASE_TARGET=darwin-arm64  Build a named release target'
	@printf '%s\n' ''
	@printf '%s\n' 'Safe shortcuts:'
	@printf '%s\n' '  make find-fast   Scrape one page from realdiscount'
	@printf '%s\n' '  make results     List saved result files'

install:
	bun install

dev:
	$(CLI)

cli-help:
	$(CLI) --help

version:
	$(CLI) --version

whoami:
	$(CLI) whoami

config:
	$(CLI) config

find:
	$(CLI) find

list:
	$(CLI) list

claim:
	$(CLI) claim

run:
	$(CLI) run --pages 10

update:
	$(CLI) update

type-check:
	bunx tsc --noEmit

test:
	bun test --pass-with-no-tests

build:
	bun run build

build-release:
	bun run build:release -- --target $(RELEASE_TARGET)

find-fast:
	$(CLI) find --source couponami --pages 1

results:
	@bun -e 'import { readdir } from "fs/promises"; import { loadConfig } from "./src/config.ts"; const { resultsDir } = await loadConfig(); try { const files = (await readdir(resultsDir)).filter((file) => file.endsWith(".json")).sort().reverse(); console.log(files.length ? files.join("\n") : "No result files in " + resultsDir); } catch { console.log("No results directory: " + resultsDir); }'

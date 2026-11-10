#!/usr/bin/env bash
# Verification shared by local runs and CI: same commands, one source of truth.
#   verify.sh         basic: install, type-check, tests, dependency audit
#   verify.sh --full  basic + browser smoke test + release build smoke
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FULL=0
case "${1:-}" in
  "") ;;
  --full) FULL=1 ;;
  *) echo "usage: verify.sh [--full]" >&2; exit 2 ;;
esac

echo "== install =="
bun install --frozen-lockfile

echo "== type-check =="
bunx tsc --noEmit

echo "== tests =="
bun test --pass-with-no-tests

echo "== audit =="
if ! bun audit; then
  echo "dependency vulnerabilities found" >&2
  exit 1
fi

if [ "$FULL" -eq 1 ]; then
  echo "== browser smoke =="
  cache="${PLAYWRIGHT_BROWSERS_PATH:-}"
  if [ -z "$cache" ]; then
    case "$(uname -s)" in
      Darwin) cache="$HOME/Library/Caches/ms-playwright" ;;
      *) cache="$HOME/.cache/ms-playwright" ;;
    esac
  fi
  firefox_exec=""
  if [ "$(uname -s)" = "Darwin" ]; then
    firefox_exec=$(
      ls -d "$cache"/firefox-*/firefox/Nightly.app/Contents/MacOS/firefox 2>/dev/null |
        sort -V | tail -1 || true
    )
  else
    firefox_exec=$(
      ls -d "$cache"/firefox-*/firefox/firefox 2>/dev/null |
        sort -V | tail -1 || true
    )
  fi
  if [ -z "$firefox_exec" ]; then
    echo "no managed firefox found under $cache" >&2
    echo "run: bunx playwright install firefox chromium" >&2
    exit 1
  fi
  export COUPON_FINDER_BROWSER_PATH="$firefox_exec"
  bun run src/cli.ts find --source couponami --pages 1

  echo "== build release =="
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')
  target="$os-$arch"
  bun run build:release -- --target "$target" --output-dir dist/release
  "./dist/release/coupon-finder-$target" --version
fi

mode=basic
[ "$FULL" -eq 1 ] && mode=full
echo "== verify OK ($mode) =="

#!/usr/bin/env bash
# Update dependencies with local verification before push.
#   update-dependencies.sh [--yes]
# Heavy-impact updates (playwright, bun runtime) ask before acting unless --yes.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

ASSUME_YES=0
case "${1:-}" in
  "") ;;
  --yes) ASSUME_YES=1 ;;
  *) echo "usage: update-dependencies.sh [--yes]" >&2; exit 2 ;;
esac

interactive_tty() { [ -t 0 ] && [ -t 1 ]; }

confirm() {
  local question="$1" answer
  if [ "$ASSUME_YES" -eq 1 ]; then
    echo "--yes: $question [yes]"
    return 0
  fi
  if ! interactive_tty; then
    echo "refusing to continue without a tty (use --yes): $question" >&2
    exit 1
  fi
  read -r -p "$question [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ]
}

sync_bun_version() {
  local version="$1" file
  for file in .github/workflows/build.yml .github/workflows/ci.yml; do
    if [ -f "$file" ] && grep -q 'BUN_VERSION:' "$file"; then
      sed -i.bak "s/BUN_VERSION: \"[^\"]*\"/BUN_VERSION: \"$version\"/" "$file"
      rm -f "$file.bak"
    fi
  done
}

dep_version() {
  grep -o "\"$1\": \"[^\"]*\"" package.json | head -1 | cut -d'"' -f4
}

echo "== preflight =="
echo "bun: $(bun --version)"
echo "playwright: $(dep_version playwright)"
echo "@types/bun: $(dep_version @types/bun)"
if [ -n "$(git status --short)" ]; then
  git status --short
  if ! interactive_tty; then
    echo "refusing to run with a dirty tree and no tty" >&2
    exit 1
  fi
  read -r -p "working tree is dirty; continue anyway? [y/N] " answer
  case "$answer" in
    y | Y) ;;
    *) exit 1 ;;
  esac
fi

echo "== outdated =="
outdated_output=$(bun outdated 2>/dev/null || true)
echo "$outdated_output"
bun_runtime_version=$(bun --version)
bun_pinned_version=$(
  grep -m1 'BUN_VERSION:' .github/workflows/build.yml 2>/dev/null |
    sed 's/.*"\(.*\)".*/\1/'
)
echo "bun runtime: local $bun_runtime_version, pinned $bun_pinned_version"
if ! echo "$outdated_output" | grep -Eq '^\|[[:space:]]+playwright[[:space:]]+\|' &&
  ! echo "$outdated_output" | grep -Eq '^\|[[:space:]]+@types/bun[[:space:]]+\|' &&
  [ "$bun_runtime_version" = "$bun_pinned_version" ]; then
  echo "already up to date"
  exit 0
fi

echo "== confirm =="
update_playwright=0
if echo "$outdated_output" | grep -Eq '^\|[[:space:]]+playwright[[:space:]]+\|'; then
  if confirm "playwright: update to latest (browser revisions + scraper API may change)?"; then
    update_playwright=1
  else
    echo "skipping playwright update"
  fi
fi
upgrade_bun=0
if [ "$bun_runtime_version" != "$bun_pinned_version" ]; then
  if confirm "bun runtime: local $bun_runtime_version vs pinned $bun_pinned_version — upgrade local bun and sync workflow pins?"; then
    upgrade_bun=1
  else
    echo "skipping bun runtime update"
  fi
fi

echo "== apply =="
if [ "$upgrade_bun" -eq 1 ]; then
  bun upgrade
  sync_bun_version "$(bun --version)"
fi
if [ "$update_playwright" -eq 1 ]; then
  bun update --latest playwright
  echo "== install browsers =="
  bunx playwright install firefox chromium
fi
bun update --latest @types/bun

echo "== verify =="
bash scripts/verify.sh --full

echo "== summary =="
echo "playwright: $(dep_version playwright)"
echo "@types/bun: $(dep_version @types/bun)"
echo "bun: $(bun --version)"
echo "changed files:"
git status --short
echo "review the diff, then commit package.json bun.lock and the workflow pins"

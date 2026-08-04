#!/usr/bin/env bash
set -euo pipefail

YES=0
usage() {
  printf 'Usage: uninstall.sh [--yes|--help]\n\nRemoves coupon-finder, its managed PATH block, data, logs, results, and dedicated browsers.\n'
}
for argument in "$@"; do
  case "${argument}" in
    --yes) YES=1 ;;
    --help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "${argument}" >&2; usage >&2; exit 2 ;;
  esac
done

BIN_DIR="${HOME}/.local/bin"
LAUNCHER="${BIN_DIR}/coupon-finder"
INSTALL_ROOT="${HOME}/.local/share/coupon-finder"
DATA_ROOT="${HOME}/.coupon-finder"
CONFIRMATION="uninstall coupon-finder"

printf 'coupon-finder uninstall will remove:\n'
printf '  %s\n  %s\n  %s\n' "${LAUNCHER}" "${INSTALL_ROOT}" "${DATA_ROOT}"
printf '  managed PATH blocks in ~/.zshrc, ~/.bashrc, and ~/.bash_profile\n'
if [[ "${YES}" -eq 0 ]]; then
  if [[ ! -t 0 ]]; then
    printf 'Refusing non-interactive uninstall without confirmation. Run:\n' >&2
    printf '  curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/uninstall.sh | bash -s -- --yes\n' >&2
    exit 1
  fi
  printf 'Type "%s" to continue: ' "${CONFIRMATION}"
  IFS= read -r answer
  [[ "${answer}" == "${CONFIRMATION}" ]] || { printf 'Uninstall cancelled.\n'; exit 1; }
fi

warn_external_results() {
  local config="$1" raw="" value="" expanded=""
  [[ -f "${config}" ]] || return 0
  case "${config}" in
    *.toml) raw="$(awk -F= '/^[[:space:]]*resultsDir[[:space:]]*=/ { sub(/^[^=]*=[[:space:]]*/, ""); print; exit }' "${config}")" ;;
    *.json) raw="$(awk 'match($0, /"resultsDir"[[:space:]]*:[[:space:]]*"[^"]*"/) { value=substr($0,RSTART,RLENGTH); sub(/^.*:[[:space:]]*"/,"",value); sub(/"$/,"",value); print value; exit }' "${config}")" ;;
  esac
  [[ -n "${raw}" ]] || return 0
  value="${raw}"
  if [[ "${value}" == \"*\" ]]; then value="${value#\"}"; value="${value%\"}"; fi
  case "${value}" in
    "~") expanded="${HOME}" ;;
    "~/"*) expanded="${HOME}/${value#\~/}" ;;
    *) expanded="${value}" ;;
  esac
  case "${expanded}" in
    "${DATA_ROOT}"|"${DATA_ROOT}/"*) return 0 ;;
  esac
  printf '⚠️  Custom resultsDir is outside %s and will not be deleted.\n' "${DATA_ROOT}" >&2
  printf '   Config value: %s\n   Path: %s\n' "${raw}" "${expanded}" >&2
}
warn_external_results "${DATA_ROOT}/config.toml"
warn_external_results "${DATA_ROOT}/config.json"

remove_path_block() {
  local rc_file="$1" temp=""
  [[ -f "${rc_file}" ]] || return 0
  grep -Fqx "# >>> coupon-finder PATH >>>" "${rc_file}" || return 0
  awk '
    $0 == "# >>> coupon-finder PATH >>>" { inside=1; starts++; next }
    $0 == "# <<< coupon-finder PATH <<<" && inside { inside=0; ends++; next }
    !inside { lines[++count]=$0 }
    END {
      if (inside || starts != ends) exit 42
      for (i=1; i<=count; i++) print lines[i]
    }
  ' "${rc_file}" >"${rc_file}.coupon-finder-preview.$$" || {
    rm -f "${rc_file}.coupon-finder-preview.$$"
    printf '⚠️  Managed PATH markers are malformed in %s; file was not changed.\n' "${rc_file}" >&2
    return 0
  }
  temp="$(mktemp "${rc_file}.coupon-finder.XXXXXX")"
  cp -p "${rc_file}" "${temp}"
  cp "${rc_file}.coupon-finder-preview.$$" "${temp}"
  rm -f "${rc_file}.coupon-finder-preview.$$"
  mv -f "${temp}" "${rc_file}"
}
remove_path_block "${HOME}/.zshrc"
remove_path_block "${HOME}/.bashrc"
remove_path_block "${HOME}/.bash_profile"

rm -f "${LAUNCHER}" "${BIN_DIR}/.coupon-finder-update.lock"
for backup in "${BIN_DIR}"/.coupon-finder.backup-*.bak; do
  [[ -e "${backup}" ]] && rm -f "${backup}"
done
rm -rf "${INSTALL_ROOT}" "${DATA_ROOT}"

if [[ "$(uname -s)" == Darwin ]]; then GLOBAL_CACHE="${HOME}/Library/Caches/ms-playwright"; else GLOBAL_CACHE="${HOME}/.cache/ms-playwright"; fi
if [[ -d "${GLOBAL_CACHE}" ]]; then
  printf '⚠️  Legacy shared Playwright cache was not removed: %s\n' "${GLOBAL_CACHE}" >&2
  printf "   Remove it manually only if no other project uses it:\n   rm -rf '%s'\n" "${GLOBAL_CACHE}" >&2
fi
printf '✅ coupon-finder was uninstalled.\n'

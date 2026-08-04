#!/usr/bin/env bash
set -euo pipefail

REPO="${COUPON_FINDER_REPO:-minatorak/coupon-finder}"
DOWNLOAD_BASE_URL="${COUPON_FINDER_DOWNLOAD_BASE_URL:-https://github.com/${REPO}/releases/latest/download}"
BIN_DIR="${HOME}/.local/bin"
INSTALL_PATH="${BIN_DIR}/coupon-finder"
INSTALL_ROOT="${HOME}/.local/share/coupon-finder"
RELEASES_DIR="${INSTALL_ROOT}/releases"
TEMP_DIR=""
STAGING_DIR=""
NEW_RELEASE=""
SWITCHED=0
ROOT_CREATED=0
CURRENT_TEMP=""
LAUNCHER_TEMP=""

fail() { printf '❌ %s\n' "$1" >&2; exit 1; }
require_command() { command -v "$1" >/dev/null 2>&1 || fail "$1 is required but was not found in PATH."; }

cleanup() {
  if [[ "${SWITCHED}" -eq 0 && -n "${NEW_RELEASE}" ]]; then rm -rf "${NEW_RELEASE}"; fi
  if [[ -n "${CURRENT_TEMP}" ]]; then rm -f "${CURRENT_TEMP}"; fi
  if [[ -n "${LAUNCHER_TEMP}" ]]; then rm -f "${LAUNCHER_TEMP}"; fi
  if [[ -n "${STAGING_DIR}" ]]; then rm -rf "${STAGING_DIR}"; fi
  if [[ "${SWITCHED}" -eq 0 && "${ROOT_CREATED}" -eq 1 ]]; then rm -rf "${INSTALL_ROOT}"; fi
  if [[ -n "${TEMP_DIR}" ]]; then rm -rf "${TEMP_DIR}"; fi
}
trap cleanup EXIT

for command_name in curl openssl mktemp tar; do require_command "${command_name}"; done
if [[ -n "${TERMUX_VERSION:-}" || "${PREFIX:-}" == *com.termux* ]]; then
  fail "Android/Termux is not supported yet."
fi

case "$(uname -s):$(uname -m)" in
  Darwin:arm64) TARGET="darwin-arm64" ;;
  Darwin:x86_64|Darwin:amd64) TARGET="darwin-x64" ;;
  Linux:x86_64|Linux:amd64) TARGET="linux-x64" ;;
  Linux:aarch64|Linux:arm64) fail "Linux ARM64 is not supported yet." ;;
  *) fail "Unsupported platform. Supported targets are macOS arm64/x64 and Linux x64." ;;
esac
ASSET="coupon-finder-${TARGET}.tar.gz"

if [[ -e "${INSTALL_PATH}" || -L "${INSTALL_PATH}" || -e "${INSTALL_ROOT}" ]]; then
  fail "An existing or legacy installation was found.\n  1. Try: coupon-finder update\n  2. If update fails: curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/uninstall.sh | bash -s -- --yes\n  3. Run the installer again."
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/coupon-finder-install.XXXXXX")"
ARCHIVE="${TEMP_DIR}/${ASSET}"
MANIFEST="${TEMP_DIR}/checksums.txt"
SIGNATURE="${TEMP_DIR}/checksums.txt.sig"
PUBLIC_KEY="${TEMP_DIR}/release-public.pem"
cat >"${PUBLIC_KEY}" <<'PUBLIC_KEY_EOF'
-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA2F8slhfCb2dONBAewPNG
e1LBBikmbMzD/mAb/OuMDk9HzcUgpnoufHiNeqhsjP8rSNzvfMTFLYNWHnJrb2SS
3x6pnayKb15TlFm0nPQjbpK3PpNYWYUvwMgNlmsaN+6oF5jIhIC6HF6omG+GDH1G
N0Kp5AjF9KjLLwyyn+lM9crbh6bc4Y21aa7AywtOvNCGaGhm0kRlIrLqJlchN0kF
ZMOOIM+aG8KZK8xh9bFOgenLXZAaLT+MQELYbmJZA2A2drdoiwyXBWv090LN/Qxi
GAGFM8zM8ZDZI5m7VP+xYTjKm2XInvc6MR8p6Y8pZmkmxaQN48tZ9jwI7GV67nTy
tkw8E6JwuqVbKDo7ljLBOjPydMfZkdVdCKU6ZjFPykLnGkymafLd1H1sykNGrid9
92eAhd2Lv1zH23F1lK273OrBDv6r27eC3S7y3YPAs1fW8VY+tmqHqbut7GRqzdwJ
clq8VMJYk69RXQJKPwPC2Rkh4ZJSwtkfqF4T5zhdBqNFAgMBAAE=
-----END PUBLIC KEY-----
PUBLIC_KEY_EOF

download() {
  curl --fail --silent --show-error --location --retry 3 --retry-delay 1 \
    "${DOWNLOAD_BASE_URL}/$1" -o "$2" || fail "Failed to download $1."
}
printf '📦 Installing coupon-finder (%s)\n' "${ASSET}"
download "${ASSET}" "${ARCHIVE}"
download checksums.txt "${MANIFEST}"
download checksums.txt.sig "${SIGNATURE}"
openssl dgst -sha256 -verify "${PUBLIC_KEY}" -signature "${SIGNATURE}" "${MANIFEST}" >/dev/null 2>&1 \
  || fail "Release checksum signature is invalid; nothing was installed."
EXPECTED_HASH="$(awk -v name="${ASSET}" '$2 == name { count++; hash=$1 } END { if (count != 1) exit 1; print hash }' "${MANIFEST}")" \
  || fail "checksums.txt has no unique entry for ${ASSET}."
COMPUTED_HASH="$(openssl dgst -sha256 -r "${ARCHIVE}" | awk '{print $1}')"
[[ "$(printf %s "${EXPECTED_HASH}" | tr '[:upper:]' '[:lower:]')" == "${COMPUTED_HASH}" ]] \
  || fail "Downloaded archive checksum does not match the signed manifest; nothing was installed."

ENTRY_LIST="${TEMP_DIR}/entries.txt"
tar -tzf "${ARCHIVE}" >"${ENTRY_LIST}" || fail "Release archive is malformed."
[[ -s "${ENTRY_LIST}" ]] || fail "Release archive is empty."
while IFS= read -r entry; do
  normalized="${entry#./}"
  case "${normalized}" in
    coupon-finder|coupon-finder/*) ;;
    *) fail "Unsafe or unexpected archive entry: ${entry}" ;;
  esac
  case "/${normalized}/" in *"/../"*|*"/./"*) fail "Unsafe archive entry: ${entry}" ;; esac
  [[ "${normalized}" != /* && "${normalized}" != *\\* ]] || fail "Unsafe archive entry: ${entry}"
done <"${ENTRY_LIST}"
# Release builds dereference dependency symlinks. Reject links entirely so an
# archive cannot redirect extraction outside the package root.
if tar -tvzf "${ARCHIVE}" | awk 'substr($1,1,1) == "l" || substr($1,1,1) == "h" { found=1 } END { exit !found }'; then
  fail "Release archive contains an unsupported link entry."
fi

ROOT_CREATED=1
mkdir -p "${RELEASES_DIR}" "${INSTALL_ROOT}/browsers" "${BIN_DIR}"
STAGING_DIR="$(mktemp -d "${INSTALL_ROOT}/.staging.XXXXXX")"
tar -xzf "${ARCHIVE}" -C "${STAGING_DIR}" || fail "Could not extract release archive."
PACKAGE_ROOT="${STAGING_DIR}/coupon-finder"
METADATA="${PACKAGE_ROOT}/RELEASE"
[[ -f "${METADATA}" ]] || fail "Release metadata is missing."
read_metadata() {
  awk -F= -v key="$1" '$1 == key && NF == 2 { count++; value=$2 } END { if (count != 1) exit 1; print value }' "${METADATA}"
}
FORMAT="$(read_metadata format)" || fail "Malformed RELEASE metadata."
VERSION="$(read_metadata version)" || fail "Malformed RELEASE metadata."
METADATA_TARGET="$(read_metadata target)" || fail "Malformed RELEASE metadata."
[[ "$(wc -l <"${METADATA}" | tr -d ' ')" -eq 3 ]] || fail "Malformed RELEASE metadata."
[[ "${FORMAT}" == 1 ]] || fail "Unsupported release format: ${FORMAT}"
[[ "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || fail "Invalid release version: ${VERSION}"
[[ "${METADATA_TARGET}" == "${TARGET}" ]] || fail "Release target mismatch: expected ${TARGET}, got ${METADATA_TARGET}"
if [[ -n "${COUPON_FINDER_EXPECTED_VERSION:-}" && "${VERSION}" != "${COUPON_FINDER_EXPECTED_VERSION}" ]]; then
  fail "Release version mismatch: expected ${COUPON_FINDER_EXPECTED_VERSION}, got ${VERSION}"
fi
for required in \
  bin/coupon-finder bin/coupon-finder-runtime \
  lib/node_modules/playwright/package.json \
  lib/node_modules/playwright-core/package.json \
  lib/node_modules/playwright-core/browsers.json \
  lib/node_modules/playwright-core/lib/coreBundle.js; do
  [[ -f "${PACKAGE_ROOT}/${required}" ]] || fail "Release package is missing ${required}."
done
chmod 0755 "${PACKAGE_ROOT}/bin/coupon-finder" "${PACKAGE_ROOT}/bin/coupon-finder-runtime"
COUPON_FINDER_INSTALL_ROOT="${INSTALL_ROOT}" \
NODE_PATH="${PACKAGE_ROOT}/lib/node_modules" \
PLAYWRIGHT_BROWSERS_PATH="${INSTALL_ROOT}/browsers" \
  "${PACKAGE_ROOT}/bin/coupon-finder-runtime" --release-smoke \
  || fail "Staged release smoke test failed; nothing was installed."

NEW_RELEASE="${RELEASES_DIR}/${VERSION}-${TARGET}-${COMPUTED_HASH:0:12}"
[[ ! -e "${NEW_RELEASE}" ]] || fail "Release directory already exists."
mv "${PACKAGE_ROOT}" "${NEW_RELEASE}"
CURRENT_TEMP="${INSTALL_ROOT}/.current.$$"
ln -s "releases/$(basename "${NEW_RELEASE}")" "${CURRENT_TEMP}"
mv -f "${CURRENT_TEMP}" "${INSTALL_ROOT}/current"
CURRENT_TEMP=""
LAUNCHER_TEMP="$(mktemp "${BIN_DIR}/.coupon-finder.XXXXXX")"
cp "${NEW_RELEASE}/bin/coupon-finder" "${LAUNCHER_TEMP}"
chmod 0755 "${LAUNCHER_TEMP}"
mv -f "${LAUNCHER_TEMP}" "${INSTALL_PATH}"
LAUNCHER_TEMP=""

if ! "${INSTALL_PATH}" --release-smoke; then
  rm -f "${INSTALL_ROOT}/current" "${INSTALL_PATH}"
  rm -rf "${NEW_RELEASE}"
  NEW_RELEASE=""
  fail "Post-install smoke test failed; installation was rolled back."
fi
SWITCHED=1

append_path_block() {
  local rc_file="$1" start="# >>> coupon-finder PATH >>>" end="# <<< coupon-finder PATH <<<"
  if [[ -f "${rc_file}" ]] && grep -Fqx "${start}" "${rc_file}"; then return; fi
  {
    printf '\n%s\n' "${start}"
    printf 'if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then\n'
    printf '  export PATH="$HOME/.local/bin:$PATH"\n'
    printf 'fi\n%s\n' "${end}"
  } >>"${rc_file}"
}
case "$(basename "${SHELL:-}")" in
  zsh) append_path_block "${HOME}/.zshrc" ;;
  bash) if [[ "$(uname -s)" == Darwin && -f "${HOME}/.bash_profile" ]]; then append_path_block "${HOME}/.bash_profile"; else append_path_block "${HOME}/.bashrc"; fi ;;
  *) printf '⚠️  Add ~/.local/bin to PATH for your shell.\n' ;;
esac
printf '✅ Installation complete: %s\n' "${INSTALL_PATH}"
"${INSTALL_PATH}" --version
printf '\nOpen a new terminal before running coupon-finder.\n'

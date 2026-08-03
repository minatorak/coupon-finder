#!/usr/bin/env bash
set -euo pipefail

REPO="${COUPON_FINDER_REPO:-minatorak/coupon-finder}"
DOWNLOAD_BASE_URL="${COUPON_FINDER_DOWNLOAD_BASE_URL:-https://github.com/${REPO}/releases/latest/download}"
INSTALL_DIR="${HOME}/.local/bin"
INSTALL_PATH="${INSTALL_DIR}/coupon-finder"
ASSET=""
TEMP_DIR=""
INSTALL_TEMP=""

cleanup() {
  if [[ -n "${INSTALL_TEMP}" && -e "${INSTALL_TEMP}" ]]; then
    rm -f "${INSTALL_TEMP}"
  fi
  if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
    rm -rf "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

fail() {
  printf '❌ %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "${1} is required but was not found in PATH."
}

for command_name in curl openssl mktemp; do
  require_command "$command_name"
done

if [[ -n "${TERMUX_VERSION:-}" || "${PREFIX:-}" == *"com.termux"* ]]; then
  fail "Android/Termux is not supported yet. Use a supported macOS or Linux desktop host."
fi

OS="$(uname -s)"
ARCH="$(uname -m)"
case "${OS}:${ARCH}" in
  Darwin:arm64)
    ASSET="coupon-finder-darwin-arm64"
    ;;
  Darwin:x86_64|Darwin:amd64)
    ASSET="coupon-finder-darwin-x64"
    ;;
  Linux:x86_64|Linux:amd64)
    ASSET="coupon-finder-linux-x64"
    ;;
  Linux:aarch64|Linux:arm64)
    fail "Linux ARM64 is not supported yet. Android/Termux is also unsupported."
    ;;
  *)
    fail "Unsupported platform: ${OS} ${ARCH}. Supported targets are macOS arm64/x64 and Linux x64."
    ;;
esac

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/coupon-finder-install.XXXXXX")"
DOWNLOADED_BINARY="${TEMP_DIR}/${ASSET}"
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

printf '📦 Installing coupon-finder (%s)\n' "${ASSET}"
printf '   Download source: %s\n' "${DOWNLOAD_BASE_URL}"

download() {
  local name="$1"
  local destination="$2"
  curl --fail --silent --show-error --location \
    --retry 3 --retry-delay 1 \
    "${DOWNLOAD_BASE_URL}/${name}" -o "${destination}" \
    || fail "Failed to download ${name}. Check that a stable GitHub Release exists."
}

download "${ASSET}" "${DOWNLOADED_BINARY}"
download "checksums.txt" "${MANIFEST}"
download "checksums.txt.sig" "${SIGNATURE}"

if ! openssl dgst -sha256 -verify "${PUBLIC_KEY}" \
    -signature "${SIGNATURE}" "${MANIFEST}" >/dev/null 2>&1; then
  fail "Release checksum signature is invalid; nothing was installed."
fi

EXPECTED_HASH="$(awk -v expected="${ASSET}" '$2 == expected { if (found) exit 2; print $1; found=1 } END { if (!found) exit 1 }' "${MANIFEST}")" \
  || fail "checksums.txt has no unique entry for ${ASSET}."
COMPUTED_HASH="$(openssl dgst -sha256 -r "${DOWNLOADED_BINARY}" | awk '{print $1}')"
EXPECTED_HASH_NORMALIZED="$(printf '%s' "${EXPECTED_HASH}" | tr '[:upper:]' '[:lower:]')"
COMPUTED_HASH_NORMALIZED="$(printf '%s' "${COMPUTED_HASH}" | tr '[:upper:]' '[:lower:]')"
if [[ "${EXPECTED_HASH_NORMALIZED}" != "${COMPUTED_HASH_NORMALIZED}" ]]; then
  fail "Downloaded binary checksum does not match the signed manifest; nothing was installed."
fi

mkdir -p "${INSTALL_DIR}"
INSTALL_TEMP="$(mktemp "${INSTALL_DIR}/.coupon-finder.XXXXXX")" \
  || fail "Cannot create a temporary file in ${INSTALL_DIR}."
chmod 0755 "${INSTALL_TEMP}"
cp "${DOWNLOADED_BINARY}" "${INSTALL_TEMP}"
mv -f "${INSTALL_TEMP}" "${INSTALL_PATH}"
INSTALL_TEMP=""

append_path_block() {
  local rc_file="$1"
  local start_marker="# >>> coupon-finder PATH >>>"
  local end_marker="# <<< coupon-finder PATH <<<"

  if [[ -f "${rc_file}" ]] && grep -Fqx "${start_marker}" "${rc_file}"; then
    return
  fi

  {
    printf '\n%s\n' "${start_marker}"
    printf 'if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then\n'
    printf '  export PATH="$HOME/.local/bin:$PATH"\n'
    printf 'fi\n%s\n' "${end_marker}"
  } >>"${rc_file}"
}

SHELL_NAME="$(basename "${SHELL:-}")"
case "${SHELL_NAME}" in
  zsh)
    append_path_block "${HOME}/.zshrc"
    ;;
  bash)
    if [[ "${OS}" == "Darwin" && -f "${HOME}/.bash_profile" ]]; then
      append_path_block "${HOME}/.bash_profile"
    else
      append_path_block "${HOME}/.bashrc"
    fi
    ;;
  *)
    printf '⚠️  Installed successfully, but shell %s was not modified.\n' "${SHELL_NAME:-unknown}"
    printf '   Add this to your shell startup file:\n'
    printf '   export PATH="$HOME/.local/bin:$PATH"\n'
    ;;
esac

printf '✅ Installation complete: %s\n' "${INSTALL_PATH}"
if command -v coupon-finder >/dev/null 2>&1; then
  coupon-finder --version
else
  "${INSTALL_PATH}" --version
fi
printf '\nOpen a new terminal before running coupon-finder.\n'

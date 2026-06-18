#!/bin/bash
set -e

VERSION="0.1.0"
REPO="minatorak/coupon-finder"

echo "📦 Installing coupon-finder v${VERSION}..."
echo "   Install: /usr/local/bin/coupon-finder"
echo ""

# Check for Bun
if ! command -v bun &> /dev/null; then
  echo "❌ Bun is required but not installed."
  echo "   Install from: https://bun.sh"
  exit 1
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Download source
echo "⬇️  Downloading from: github.com/${REPO}"
if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/main.zip" -o "$TEMP_DIR/coupon-finder.zip"; then
  echo "❌ Failed to download coupon-finder"
  exit 1
fi

cd "$TEMP_DIR"
unzip -q coupon-finder.zip
PROJECT_DIR=$(ls -d coupon-finder-* 2>/dev/null | head -1)
cd "$PROJECT_DIR/coupon-finder"

# Install dependencies
echo "📦 Installing dependencies..."
bun install --production

# Create wrapper script
WRAPPER="$TEMP_DIR/coupon-finder-wrapper"
cat > "$WRAPPER" << 'WRAPPER_EOF'
#!/bin/bash
SCRIPT_DIR="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
PROJECT_DIR="${SCRIPT_DIR}/.coupon-finder"
exec bun run "$PROJECT_DIR/src/cli.ts" "$@"
WRAPPER_EOF

chmod +x "$WRAPPER"

# Install
if [ -w /usr/local/bin ]; then
  cp -r coupon-finder /usr/local/.coupon-finder
  cp "$WRAPPER" /usr/local/bin/coupon-finder
  sed -i '' 's|${SCRIPT_DIR}/.coupon-finder|/usr/local/.coupon-finder|g' /usr/local/bin/coupon-finder
else
  echo "⚠️  /usr/local/bin is not writable. Using sudo..."
  sudo cp -r coupon-finder /usr/local/.coupon-finder
  sudo cp "$WRAPPER" /usr/local/bin/coupon-finder
  sudo sed -i '' 's|${SCRIPT_DIR}/.coupon-finder|/usr/local/.coupon-finder|g' /usr/local/bin/coupon-finder
fi

echo "✅ Installation complete!"
echo ""
echo "Verify: coupon-finder --help"
echo "Get started: coupon-finder whoami"

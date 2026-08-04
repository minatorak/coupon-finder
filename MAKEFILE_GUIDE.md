# Makefile Guide — coupon-finder

The Makefile runs the source CLI through Bun. Scrape and browser-test targets
are intentionally limited to one source page.

## Setup and checks

```bash
make install       # Install dependencies
make type-check    # TypeScript strict checks
make test          # Unit tests
make build         # Compile the native release executable
```

## One-page browser tests

Each browser target saves the selected browser to
`~/.coupon-finder/config.toml`, then scrapes one page from `couponscorpion`.

```bash
make test-firefox
make test-chrome
make test-brave
```

Choose another coupon source without changing the one-page limit:

```bash
make test-firefox TEST_SOURCE=couponami
make test-chrome TEST_SOURCE=udemyxpert
make test-brave TEST_SOURCE=couponscorpion
```

The generic form is:

```bash
make test-browser TEST_BROWSER=firefox TEST_SOURCE=couponscorpion
```

Supported values for `TEST_BROWSER` are `firefox`, `chrome`, and `brave`.
Supported values for `TEST_SOURCE` are `realdiscount`, `couponscorpion`,
`udemyxpert`, and `couponami`.

## Change browser without scraping

```bash
make browser-firefox
make browser-chrome
make browser-brave
```

The equivalent CLI commands are:

```bash
bun run src/cli.ts config --set browser=firefox
bun run src/cli.ts config --set browser=chrome
bun run src/cli.ts config --set browser=brave
```

## Browser behavior

- `firefox`: reads the Udemy session from installed Firefox, while scraping
  uses the matching Playwright Firefox. It is downloaded on the first
  `find`/`run` only when missing.
- `chrome`: reads the Udemy session from installed Chrome, while scraping uses
  Playwright Chromium (Chrome for Testing). It is downloaded on the first
  `find`/`run` only when missing.
- `brave`: reads the session from and scrapes with installed Brave. Playwright
  does not provide a bundled Brave download.

Firefox and Chrome browser files are cached by Playwright, so later runs reuse
them. The first run needs an internet connection and may take longer while the
browser archive is downloaded.

## Other one-page commands

```bash
make find       # All configured sources, one page each
make find-fast  # couponami only, one page
make run        # find (one page), list, then claim
make results    # List saved JSON result files
```

Run `make help` for the complete target list.

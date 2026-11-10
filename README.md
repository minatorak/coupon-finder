# coupon-finder

Find Udemy course offers, verify which ones are free, and open claimable courses for manual enrollment.

`coupon-finder` collects offers from four coupon sources, removes duplicate Udemy URLs, checks enrollment and coupon status through Udemy, then opens eligible course pages in batches.

> `claim` does not enroll automatically. It opens verified free or 100%-off course pages; you complete enrollment on Udemy.

## Requirements

Installed releases support:

- macOS Apple Silicon
- macOS Intel
- Linux x64

You also need:

- Firefox, Chrome, or Brave installed
- Active Udemy login in selected browser
- `curl`, `openssl`, and `mktemp` for installer

Windows, Linux ARM64, and Android/Termux are not currently supported by release installer.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/minatorak/coupon-finder/main/install.sh | bash
```

Installer verifies signed checksum, installs executable at `~/.local/bin/coupon-finder`, and does not use `sudo`. Open new terminal, then verify:

```bash
coupon-finder --version
```

## Quick start

1. Log in to [Udemy](https://www.udemy.com/) in Firefox, Chrome, or Brave.
2. Select browser when not using Firefox:

   ```bash
   coupon-finder config --set browser=chrome
   ```

3. Verify session:

   ```bash
   coupon-finder whoami
   ```

4. Run full workflow:

   ```bash
   coupon-finder run --pages 5
   ```

Workflow runs `find → list → claim`. Claimable pages open 10 at a time; press Enter to open next batch and complete enrollment on Udemy.

To run each step separately:

```bash
coupon-finder find --pages 5
coupon-finder list
coupon-finder claim
```

## Account access

`coupon-finder` never asks for Udemy password. It reads active Udemy access token from selected browser profile and uses token for Udemy API requests. Token is not written to course result files.

If this access model is unsuitable, do not run `whoami`, `list`, or `run` against that browser profile.

## Commands

| Command | Purpose |
| --- | --- |
| `whoami` | Validate Udemy session |
| `config` | Create, view, or edit configuration |
| `find` | Discover and merge course offers |
| `list` | Check enrollment and free-coupon status |
| `claim` | Open claimable course pages for manual enrollment |
| `run` | Run `find`, `list`, and `claim` |
| `update` | Install selected compatible signed release |

See [CLI reference](docs/cli-reference.md) for every option and setting.

## Coupon sources

- `realdiscount` — direct source API
- `couponscorpion` — source and course pages
- `udemyxpert` — source and course pages
- `couponami` — source and course pages

Sources run concurrently by default. Browser-based sources also resolve course pages with bounded concurrency.

## Result files

Results are stored in `~/.coupon-finder/results/`:

- `*_scrape.json` — raw discovered courses
- `*_merged.json` — URL-deduplicated courses
- `*_checked.json` — enrollment and coupon checks

Running `find` removes entries in this directory older than three days. Keep unrelated files elsewhere.

## Troubleshooting

### `coupon-finder: command not found`

Open new terminal after installation. For unsupported shell, add:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Udemy session not found

Confirm you are logged in to Udemy in configured browser:

```bash
coupon-finder config --set browser=firefox
coupon-finder whoami
```

### Source fails or returns no courses

Try one source with one page:

```bash
coupon-finder find --source realdiscount --pages 1
```

One failed source does not discard results returned by other sources.

### Browser scraping is slow

Reduce concurrency or run sources sequentially:

```bash
coupon-finder find --parallel 2 --no-source-parallel
```

### Update cannot run

`coupon-finder update` works only from installed release executable. Development command `bun run src/cli.ts update` is intentionally rejected.

## Documentation

- [CLI reference](docs/cli-reference.md)
- [Architecture](docs/architecture.md)
- [Udemy API implementation reference](docs/api-udemy.md)
- [Contributing](CONTRIBUTING.md)
- [Releasing](docs/releasing.md)
- [Domain language](CONTEXT.md)

## Development

```bash
bun install
bun run src/cli.ts --help
bunx tsc --noEmit
bun test
```

## License

[MIT](LICENSE) © 2026 minatorak

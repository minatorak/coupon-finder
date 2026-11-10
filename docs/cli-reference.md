# CLI reference

Complete command reference for `coupon-finder`.

## Global options

```bash
coupon-finder --help
coupon-finder --version
```

Unknown commands and failed operations exit with status `1`. Successful commands exit with status `0`.

## `whoami`

Validate the Udemy session in the configured browser and show the authenticated user.

```bash
coupon-finder whoami
```

The command requires an active Udemy login in Firefox, Chrome, or Brave.

## `config`

Create, view, or edit `~/.coupon-finder/config.toml`.

```bash
coupon-finder config
coupon-finder config --set pages=5
coupon-finder config --set browser=chrome
coupon-finder config --set sources=realdiscount,couponami
```

With no saved configuration, `config` starts interactive setup. With an existing configuration, it asks whether to edit; declining prints current values.

Settings used by current workflow:

| Setting | Values | Default | Purpose |
| --- | --- | --- | --- |
| `pages` | Positive integer | `1` | Source pages processed per enabled source |
| `sources` | Comma-separated source names | All sources | Sources used by `find` |
| `sourceParallel` | Boolean | `true` | Run enabled sources concurrently |
| `parallel` | Positive integer | `4` | Course pages opened concurrently per browser-based source |
| `browser` | `firefox`, `chrome`, `brave` | `firefox` | Browser used for scraping and Udemy session lookup |
| `headless` | Boolean | `true` | Hide browser windows used by browser-based scrapers |

Boolean values accept `true`, `false`, `1`, `0`, `yes`, `no`, `y`, `n`, `on`, or `off`.

## `find`

Discover course offers, resolve Udemy URLs, merge duplicates, and save results.

```bash
coupon-finder find [OPTIONS]
```

Options:

| Option | Meaning |
| --- | --- |
| `--pages N` | Override pages processed per source |
| `--source NAME` | Use one source: `couponscorpion`, `realdiscount`, `udemyxpert`, or `couponami` |
| `--parallel N` | Override concurrent course pages per browser-based source |
| `--source-parallel` | Run sources concurrently |
| `--no-source-parallel` | Run sources sequentially |
| `--no-parallel` | Alias for `--no-source-parallel` |

Examples:

```bash
coupon-finder find --pages 5
coupon-finder find --source realdiscount --pages 2
coupon-finder find --parallel 2 --no-source-parallel
```

One source failing does not discard successful results from other sources.

## `list`

Load newest merged result, check enrollment and coupon status through Udemy, then save checked result.

```bash
coupon-finder list
```

The command groups courses as claimable, already enrolled, unavailable, or failed to check. It requires active Udemy session.

## `claim`

Open claimable course pages in system default browser.

```bash
coupon-finder claim
```

`claim` has no options. It opens up to 10 URLs at once and waits for Enter before next batch. User completes enrollment on Udemy; command does not submit checkout or enrollment request.

## `run`

Run complete workflow: `find`, `list`, then `claim`.

```bash
coupon-finder run [FIND OPTIONS]
```

`run` accepts every `find` option. It stops before `claim` when current run produces no checked courses.

## `update`

Select and install compatible signed release.

```bash
coupon-finder update
```

`update` works only from installed executable named `coupon-finder`. It:

1. Lists stable releases containing compatible binary, checksum manifest, and signature.
2. Verifies signed manifest and selected binary hash.
3. Keeps one backup beside installed executable.
4. Replaces executable atomically.

If install directory is not writable, reinstall into `~/.local/bin` or fix directory permissions. Do not use `sudo` with project installer.

## Result files

Results live in `~/.coupon-finder/results/`:

- `<timestamp>_scrape.json` — raw discovered courses
- `<timestamp>_merged.json` — URL-deduplicated courses
- `<timestamp>_checked.json` — enrollment and coupon checks

Running `find` removes entries in this directory older than three days. Keep unrelated files elsewhere.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DEBUG` | Enable debug console logs |
| `COUPON_FINDER_BROWSER_PATH` | Override browser executable path |
| `COUPON_FINDER_HOME` | Override home path used while locating browser profiles |
| `COUPON_FINDER_REPO` | Override GitHub repository used by installer |
| `COUPON_FINDER_DOWNLOAD_BASE_URL` | Override release download base URL used by installer |

## Make shortcuts

Run `make help` for current targets. Common development shortcuts:

```bash
make install
make cli-help
make find
make list
make claim
make type-check
make test
```

#!/usr/bin/env bun
import { whoami } from "./commands/whoami";
import { configCmd } from "./commands/config-cmd";
import { find } from "./commands/find";
import { list } from "./commands/list";
import { claim } from "./commands/claim";
import { run } from "./commands/run";
import { update } from "./commands/update";
import { logger } from "./utils/logger";
import { VERSION } from "./version";
import { FindOptions } from "./commands/find";
import { SourceType } from "./types";

export async function releaseSmoke(): Promise<void> {
  const [{ chromium, firefox }, { registry }] = await Promise.all([
    import("playwright"),
    import("playwright-core/lib/coreBundle"),
  ]);
  if (!chromium || !firefox) throw new Error("Packaged Playwright browser types are unavailable.");
  for (const browser of ["chromium", "firefox"] as const) {
    const executable = registry.registry.findExecutable(browser);
    if (!executable?.directory || !executable.executablePath() || executable.downloadURLs.length === 0) {
      throw new Error(`Packaged Playwright metadata is unavailable for ${browser}.`);
    }
  }
}

function parseFindOptions(args: string[]): FindOptions {
  const options: FindOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pages" && args[i + 1]) {
      options.pages = Number.parseInt(args[++i], 10);
    } else if (args[i] === "--source" && args[i + 1]) {
      options.source = args[++i] as SourceType;
    } else if (args[i] === "--parallel" && args[i + 1]) {
      options.parallel = Number.parseInt(args[++i], 10);
    } else if (args[i] === "--source-parallel") {
      options.sourceParallel = true;
    } else if (
      args[i] === "--no-source-parallel" ||
      args[i] === "--no-parallel"
    ) {
      options.sourceParallel = false;
    }
  }

  return options;
}

async function main() {
  const args = Bun.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case "--version":
      case "-v":
        console.log(`coupon-finder v${VERSION}`);
        break;

      case "--release-smoke":
        await releaseSmoke();
        break;

      case "whoami":
        await whoami();
        break;

      case "config":
        await configCmd(args.slice(1));
        break;

      case "find":
        await find(parseFindOptions(args.slice(1)));
        break;

      case "run":
        await run(parseFindOptions(args.slice(1)));
        break;

      case "list":
        await list();
        break;

      case "claim":
        await claim();
        break;

      case "update":
        await update();
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error(
      `Error: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
coupon-finder v${VERSION}

Find, check, and claim free Udemy courses from multiple coupon sources.

USAGE:
  coupon-finder <COMMAND> [OPTIONS]

COMMANDS:
  whoami          Check your Udemy login session
  config          View or edit configuration
  find            Scrape coupons from configured sources
  list            Check enrollment status for scraped courses
  claim           Open free/100% off course pages in browser (batches of 10)
  run             Run find, list, then claim in sequence
  update          Check for and install updates

OPTIONS:
  --version, -v   Show version
  --help, -h      Show this help message

FIND OPTIONS:
  --parallel N            Max course pages open at once per source
  --source-parallel       Scrape sources in parallel
  --no-source-parallel    Scrape sources sequentially
  --no-parallel           Alias for --no-source-parallel

EXAMPLES:
  coupon-finder whoami
  coupon-finder config
  coupon-finder config --set pages=10
  coupon-finder config --set sourceParallel=false
  coupon-finder config --set parallel=4
  coupon-finder find --pages 5
  coupon-finder find --parallel 4
  coupon-finder find --no-source-parallel
  coupon-finder run --pages 5
  coupon-finder list
  coupon-finder claim
  coupon-finder update

For more info, visit: https://github.com/minatorak/coupon-finder
  `);
}

await main().catch((error) => {
  logger.error(`Fatal error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

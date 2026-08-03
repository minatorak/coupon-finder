import {
  configExists,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  formatConfig,
} from "../config";
import { Config, SOURCE_TYPES, SourceType } from "../types";
import { logger } from "../utils/logger";
import { createInterface } from "readline/promises";

const VALID_SOURCES = new Set<string>(SOURCE_TYPES);

export async function configCmd(args: string[]): Promise<void> {
  const hasExistingConfig = configExists();
  const config = hasExistingConfig
    ? await loadConfig()
    : getDefaultConfig();

  if (args.length === 0) {
    if (!hasExistingConfig) {
      const configured = await promptForConfig(config, true);
      await saveConfig(configured);
      console.log();
      console.log(`✅ Saved configuration to config.toml`);
      console.log(formatConfig(configured));
      return;
    }

    if (await shouldEditConfig()) {
      const updated = await promptForConfig(config, false);
      await saveConfig(updated);
      console.log();
      console.log("✅ Configuration updated.");
      console.log(formatConfig(updated));
      return;
    }

    console.log();
    console.log("Using saved configuration.");
    console.log(formatConfig(config));
    return;
  }

  // Handle --set
  if (args[0] === "--set" && args[1]) {
    const [key, value] = args[1].split("=");

    if (!key || !value) {
      logger.error("Invalid format. Use: --set key=value");
      process.exit(1);
    }

    try {
      const updated = updateConfigField(config, key, value);
      await saveConfig(updated);
      console.log();
      console.log(`✅ Updated: ${key} = ${value}`);
      console.log();
    } catch (error) {
      logger.error(
        `Failed to update config: ${error instanceof Error ? error.message : error}`
      );
      process.exit(1);
    }
  } else {
    logger.error("Unknown command. Use: coupon-finder config [--set key=value]");
    process.exit(1);
  }
}

function updateConfigField(config: Config, key: string, value: string): Config {
  const updated = { ...config };

  switch (key) {
    case "pages":
      const pages = Number.parseInt(value, 10);
      if (isNaN(pages) || pages < 1) {
        throw new Error("pages must be a positive integer");
      }
      updated.pages = pages;
      break;

    case "browser":
      if (!["firefox", "chrome", "brave"].includes(value)) {
        throw new Error("browser must be firefox, chrome, or brave");
      }
      updated.browser = value as "firefox" | "chrome" | "brave";
      break;

    case "sourceParallel":
      updated.sourceParallel = parseBoolean(value);
      break;

    case "parallel":
      const coursePageParallel = Number.parseInt(value, 10);
      if (isNaN(coursePageParallel) || coursePageParallel < 1) {
        throw new Error("parallel must be a positive integer");
      }
      updated.parallel = coursePageParallel;
      break;

    case "headless":
      updated.headless = parseBoolean(value);
      break;

    case "expandCoupons":
      updated.expandCoupons = parseBoolean(value);
      break;

    case "resultsDir":
      if (!value.trim()) {
        throw new Error("resultsDir must not be empty");
      }
      updated.resultsDir = value;
      break;

    case "sources":
      const sources = value
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is SourceType => VALID_SOURCES.has(s));
      if (sources.length === 0) {
        throw new Error(`sources must include at least one of: ${SOURCE_TYPES.join(", ")}`);
      }
      updated.sources = sources;
      break;

    default:
      throw new Error(`Unknown config key: ${key}`);
  }

  return updated;
}

function parseBoolean(value: string): boolean {
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw new Error("value must be true or false");
}

async function shouldEditConfig(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question("Edit configuration? [y/N] ");
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    readline.close();
  }
}

async function promptForConfig(config: Config, isFirstRun: boolean): Promise<Config> {
  if (!process.stdin.isTTY) {
    logger.warn("Interactive setup needs a terminal; saving the default configuration.");
    return config;
  }

  console.log();
  console.log(isFirstRun ? "First-time configuration" : "Edit configuration");
  console.log("Press Enter to keep the value shown in brackets.");

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const pages = await askPositiveInt(readline, "Pages per source", config.pages);
    const sources = await askSources(readline, config.sources);
    const sourceParallel = await askBoolean(
      readline,
      "Scrape sources concurrently",
      config.sourceParallel
    );
    const parallel = await askPositiveInt(
      readline,
      "Concurrent course pages per source",
      config.parallel
    );
    const browser = await askBrowser(readline, config.browser);
    const headless = await askBoolean(readline, "Run browser headless", config.headless);
    const expandCoupons = await askBoolean(
      readline,
      "Find instructor-wide coupons",
      config.expandCoupons
    );
    const resultsDir = await askText(readline, "Results directory", config.resultsDir);

    return {
      pages,
      sources,
      sourceParallel,
      parallel,
      browser,
      headless,
      expandCoupons,
      resultsDir,
    };
  } finally {
    readline.close();
  }
}

type Readline = ReturnType<typeof createInterface>;

async function askText(readline: Readline, label: string, defaultValue: string): Promise<string> {
  const answer = (await readline.question(`${label} [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function askPositiveInt(readline: Readline, label: string, defaultValue: number): Promise<number> {
  while (true) {
    const answer = await askText(readline, label, String(defaultValue));
    const value = Number.parseInt(answer, 10);
    if (Number.isInteger(value) && value >= 1) return value;
    console.log("Please enter a positive integer.");
  }
}

async function askBoolean(readline: Readline, label: string, defaultValue: boolean): Promise<boolean> {
  while (true) {
    const answer = await askText(readline, `${label} (yes/no)`, defaultValue ? "yes" : "no");
    try {
      return parseBoolean(answer);
    } catch {
      console.log("Please answer yes or no.");
    }
  }
}

async function askBrowser(
  readline: Readline,
  defaultValue: Config["browser"]
): Promise<Config["browser"]> {
  while (true) {
    const answer = await askText(readline, "Browser (firefox/chrome/brave)", defaultValue);
    if (["firefox", "chrome", "brave"].includes(answer)) {
      return answer as Config["browser"];
    }
    console.log("Please enter firefox, chrome, or brave.");
  }
}

async function askSources(readline: Readline, defaultValue: SourceType[]): Promise<SourceType[]> {
  while (true) {
    const answer = await askText(readline, "Sources (comma-separated)", defaultValue.join(","));
    const sources = answer
      .split(",")
      .map((source) => source.trim())
      .filter((source): source is SourceType => VALID_SOURCES.has(source));
    if (sources.length > 0) return [...new Set(sources)];
    console.log(`Please include at least one of: ${SOURCE_TYPES.join(", ")}.`);
  }
}

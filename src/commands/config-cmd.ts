import {
  loadConfig,
  saveConfig,
  formatConfig,
} from "../config";
import { Config, SOURCE_TYPES, SourceType } from "../types";
import { logger } from "../utils/logger";

const VALID_SOURCES = new Set<string>(SOURCE_TYPES);

export async function configCmd(args: string[]): Promise<void> {
  const config = await loadConfig();

  // Show config
  if (args.length === 0) {
    console.log();
    console.log(formatConfig(config));
    console.log();
    console.log(
      "📝 Edit with: coupon-finder config --set <key>=<value>"
    );
    console.log("Examples:");
    console.log("  coupon-finder config --set pages=10");
    console.log("  coupon-finder config --set browser=chrome");
    console.log("  coupon-finder config --set sourceParallel=false");
    console.log("  coupon-finder config --set parallel=4");
    console.log(
      "  coupon-finder config --set sources=realdiscount,udemyxpert,couponami"
    );
    console.log();
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

    case "autoOpen":
      updated.autoOpen = parseBoolean(value);
      break;

    case "expandCoupons":
      updated.expandCoupons = parseBoolean(value);
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
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

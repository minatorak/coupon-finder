import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { CONFIG_FILE, COUPON_FINDER_DIR, RESULTS_DIR } from "./utils/paths";
import { Config, SourceType } from "./types";
import { logger } from "./utils/logger";

const DEFAULT_CONFIG: Config = {
  pages: 1,
  sources: ["realdiscount", "couponscorpion", "udemyxpert", "discudemy"],
  parallel: true,
  browser: "firefox",
  headless: true,
  autoOpen: false,
  expandCoupons: true,
  resultsDir: RESULTS_DIR,
};

let cachedConfig: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;

  // Ensure directories exist
  await mkdir(COUPON_FINDER_DIR, { recursive: true });
  await mkdir(RESULTS_DIR, { recursive: true });

  if (!existsSync(CONFIG_FILE)) {
    logger.info(
      `Creating default config at ${CONFIG_FILE}`
    );
    await saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(content) as Config;
    cachedConfig = parsed;
    return parsed;
  } catch (error) {
    logger.warn(`Failed to load config: ${error}. Using defaults.`);
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(COUPON_FINDER_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  cachedConfig = config;
}

export async function updateConfig(
  updates: Partial<Config>
): Promise<Config> {
  const config = await loadConfig();
  const updated = { ...config, ...updates };
  await saveConfig(updated);
  return updated;
}

export function formatConfig(config: Config): string {
  return `✅ Config: ${CONFIG_FILE}

pages: ${config.pages}
sources: [${config.sources.map((s) => `"${s}"`).join(", ")}]
parallel: ${config.parallel}
browser: "${config.browser}"
headless: ${config.headless}
autoOpen: ${config.autoOpen}
expandCoupons: ${config.expandCoupons}
resultsDir: "${config.resultsDir}"`;
}

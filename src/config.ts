import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { CONFIG_FILE, COUPON_FINDER_DIR, RESULTS_DIR } from "./utils/paths";
import { Config, SOURCE_TYPES, SourceType } from "./types";
import { logger } from "./utils/logger";

type ConfigInput = Partial<Config> &
  Record<string, unknown> & {
    parallel?: boolean | number;
    sourceParallel?: boolean;
  };

const DEFAULT_CONFIG: Config = {
  pages: 1,
  sources: [...SOURCE_TYPES],
  sourceParallel: true,
  parallel: 4,
  browser: "firefox",
  headless: true,
  autoOpen: false,
  expandCoupons: true,
  resultsDir: RESULTS_DIR,
};

let cachedConfig: Config | null = null;

function normalizeSource(source: SourceType | "discudemy"): SourceType {
  return source === "discudemy" ? "couponami" : source;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeBrowser(value: unknown): Config["browser"] {
  return value === "chrome" || value === "brave" ? value : "firefox";
}

function normalizeSources(value: unknown): SourceType[] {
  if (!Array.isArray(value)) {
    return [...SOURCE_TYPES];
  }

  const sources = value
    .filter((source): source is string => typeof source === "string")
    .map((source) => normalizeSource(source as SourceType | "discudemy"))
    .filter((source): source is SourceType =>
      (SOURCE_TYPES as readonly string[]).includes(source)
    );

  const normalized = Array.from(new Set(sources));
  return normalized.length > 0 ? normalized : [...SOURCE_TYPES];
}

function normalizeConfig(config: ConfigInput): Config {
  const sourceParallel =
    normalizeBoolean(
      config.sourceParallel,
      normalizeBoolean(config.parallel, DEFAULT_CONFIG.sourceParallel)
    );
  const parallel = normalizePositiveInt(config.parallel, DEFAULT_CONFIG.parallel);

  return {
    pages: normalizePositiveInt(config.pages, DEFAULT_CONFIG.pages),
    sources: normalizeSources(config.sources),
    sourceParallel,
    parallel,
    browser: normalizeBrowser(config.browser),
    headless: normalizeBoolean(config.headless, DEFAULT_CONFIG.headless),
    autoOpen: normalizeBoolean(config.autoOpen, DEFAULT_CONFIG.autoOpen),
    expandCoupons: normalizeBoolean(
      config.expandCoupons,
      DEFAULT_CONFIG.expandCoupons
    ),
    resultsDir:
      typeof config.resultsDir === "string" && config.resultsDir.trim().length > 0
        ? config.resultsDir
        : DEFAULT_CONFIG.resultsDir,
  };
}

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
    const parsed = JSON.parse(content) as ConfigInput;
    cachedConfig = normalizeConfig(parsed);
    return cachedConfig;
  } catch (error) {
    logger.warn(`Failed to load config: ${error}. Using defaults.`);
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(COUPON_FINDER_DIR, { recursive: true });
  const normalized = normalizeConfig(config as ConfigInput);
  await writeFile(CONFIG_FILE, JSON.stringify(normalized, null, 2), "utf-8");
  cachedConfig = normalized;
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
sourceParallel: ${config.sourceParallel}
parallel: ${config.parallel} (course pages per source)
browser: "${config.browser}"
headless: ${config.headless}
autoOpen: ${config.autoOpen}
expandCoupons: ${config.expandCoupons}
resultsDir: "${config.resultsDir}"`;
}

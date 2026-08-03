import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import {
  CONFIG_FILE,
  COUPON_FINDER_DIR,
  LEGACY_CONFIG_FILE,
  RESULTS_DIR,
} from "./utils/paths";
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

/** Returns a new copy so callers can safely use it as an editable draft. */
export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG, sources: [...DEFAULT_CONFIG.sources] };
}

/** Whether the user has previously saved either the current or legacy config. */
export function configExists(): boolean {
  return existsSync(CONFIG_FILE) || existsSync(LEGACY_CONFIG_FILE);
}

function stripTomlComment(line: string): string {
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && !escaped) quoted = !quoted;
    if (character === "#" && !quoted) return line.slice(0, index);
    escaped = character === "\\" && !escaped;
    if (character !== "\\") escaped = false;
  }

  return line;
}

function parseTomlValue(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('"') || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  throw new Error(`Unsupported TOML value: ${trimmed}`);
}

function parseToml(content: string): ConfigInput {
  const parsed: Record<string, unknown> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;

    const separator = line.indexOf("=");
    if (separator === -1) {
      throw new Error(`Invalid TOML line: ${rawLine}`);
    }

    const key = line.slice(0, separator).trim();
    if (!key) throw new Error(`Missing TOML key: ${rawLine}`);
    parsed[key] = parseTomlValue(line.slice(separator + 1));
  }

  return parsed as ConfigInput;
}

function quoteToml(value: string): string {
  return JSON.stringify(value);
}

function serializeToml(config: Config): string {
  return `# Number of pages to scrape from each enabled coupon source.\npages = ${config.pages}\n\n# Coupon sources to scrape. Remove a source to skip it.\nsources = [${config.sources.map(quoteToml).join(", ")}]\n\n# Scrape all enabled sources at the same time.\nsourceParallel = ${config.sourceParallel}\n\n# Maximum course pages to open concurrently for each source.\nparallel = ${config.parallel}\n\n# Browser used to read your logged-in Udemy session (firefox, chrome, or brave).\nbrowser = ${quoteToml(config.browser)}\n\n# Run the installed system browser without showing a window.\nheadless = ${config.headless}\n\n# Look for instructor-wide coupons in addition to course-specific coupons.\nexpandCoupons = ${config.expandCoupons}\n\n# Directory where scraped and checked course results are stored.\nresultsDir = ${quoteToml(config.resultsDir)}\n`;
}

export async function loadConfig(): Promise<Config> {
  if (cachedConfig) return cachedConfig;

  // Ensure directories exist
  await mkdir(COUPON_FINDER_DIR, { recursive: true });
  await mkdir(RESULTS_DIR, { recursive: true });

  if (!existsSync(CONFIG_FILE) && !existsSync(LEGACY_CONFIG_FILE)) {
    logger.info(
      `Creating default config at ${CONFIG_FILE}`
    );
    const config = getDefaultConfig();
    await saveConfig(config);
    return config;
  }

  try {
    const hasTomlConfig = existsSync(CONFIG_FILE);
    const content = await readFile(
      hasTomlConfig ? CONFIG_FILE : LEGACY_CONFIG_FILE,
      "utf-8"
    );
    const parsed = hasTomlConfig
      ? parseToml(content)
      : (JSON.parse(content) as ConfigInput);
    cachedConfig = normalizeConfig(parsed);

    if (!hasTomlConfig) {
      await saveConfig(cachedConfig);
      logger.info(`Migrated legacy config to ${CONFIG_FILE}`);
    }

    return cachedConfig;
  } catch (error) {
    logger.warn(`Failed to load config: ${error}. Using defaults.`);
    cachedConfig = getDefaultConfig();
    return cachedConfig;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await mkdir(COUPON_FINDER_DIR, { recursive: true });
  const normalized = normalizeConfig(config as ConfigInput);
  await writeFile(CONFIG_FILE, serializeToml(normalized), "utf-8");
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
expandCoupons: ${config.expandCoupons}
resultsDir: "${config.resultsDir}"`;
}

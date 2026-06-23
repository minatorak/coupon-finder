import { loadConfig } from "../config";
import { getScraperPlugins } from "../plugins/registry";
import { mergeCourses, countBySource } from "../merge/merger";
import { saveResults } from "../storage/results";
import { cleanupOldResults } from "../storage/cleanup";
import { logger } from "../utils/logger";
import { mapBrowserConfig } from "../utils/browser";
import { Course, SourceType } from "../types";

interface FindOptions {
  pages?: number;
  source?: SourceType;
  sourceParallel?: boolean;
  parallel?: number;
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }

  return fallback;
}

export async function find(options: FindOptions = {}): Promise<void> {
  try {
    await cleanupOldResults();

    const config = await loadConfig();
    const pages = normalizePositiveInt(options.pages, config.pages);
    const sourceParallel =
      options.sourceParallel !== undefined
        ? options.sourceParallel
        : config.sourceParallel;
    const parallel = normalizePositiveInt(options.parallel, config.parallel);
    const sources = options.source ? [options.source] : config.sources;
    const sourceLabel = sources.length === 1 ? "source" : "sources";

    logger.info(
      `🔍 Scraping ${sources.length} ${sourceLabel}${sourceParallel ? " in parallel" : " sequentially"} with up to ${parallel} course page(s) per source...`
    );

    const scrapers = getScraperPlugins(sources);
    let allCourses: Course[] = [];

    if (sourceParallel) {
      const browserType = mapBrowserConfig(config.browser);
      const results = await Promise.allSettled(
        scrapers.map((scraper) =>
          scraper.scrape(pages, parallel, config.headless, browserType)
        )
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const source = sources[i];

        if (result.status === "fulfilled") {
          logger.info(`✅ ${source}: ${result.value.length} courses`);
          allCourses.push(...result.value);
        } else {
          logger.warn(`❌ ${source}: ${result.reason}`);
        }
      }
    } else {
      const browserType = mapBrowserConfig(config.browser);
      for (let i = 0; i < scrapers.length; i++) {
        const scraper = scrapers[i];
        const source = sources[i];

        try {
          const courses = await scraper.scrape(pages, parallel, config.headless, browserType);
          logger.info(`✅ ${source}: ${courses.length} courses`);
          allCourses.push(...courses);
        } catch (error) {
          logger.warn(`❌ ${source}: ${error}`);
        }
      }
    }

    // Merge and deduplicate
    const merged = mergeCourses(allCourses);
    const counts = countBySource(allCourses);

    console.log();
    console.log(`📊 Raw: ${allCourses.length} total courses`);
    for (const [source, count] of Object.entries(counts)) {
      console.log(`   ${source}: ${count}`);
    }
    console.log(`✨ Merged: ${merged.length} unique courses (deduplicated by URL)`);
    console.log();

    // Save results
    await saveResults(allCourses, "scrape");
    await saveResults(merged, "merged");

    logger.info("✅ Find complete. Results saved to ~/.coupon-finder/results/");
  } catch (error) {
    logger.error(`Find failed: ${error}`);
    process.exit(1);
  }
}

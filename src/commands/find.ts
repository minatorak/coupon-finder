import { loadConfig } from "../config";
import { getScraperPlugins } from "../plugins/registry";
import { mergeCourses, countBySource } from "../merge/merger";
import { saveResults } from "../storage/results";
import { cleanupOldResults } from "../storage/cleanup";
import { retryWithTimeout } from "../utils/retry";
import { logger } from "../utils/logger";
import { SourceType } from "../types";

interface FindOptions {
  pages?: number;
  source?: SourceType;
  parallel?: boolean;
}

export async function find(options: FindOptions = {}): Promise<void> {
  try {
    await cleanupOldResults();

    const config = await loadConfig();
    const pages = options.pages || config.pages;
    const parallel = options.parallel !== undefined ? options.parallel : config.parallel;
    const sources = options.source ? [options.source] : config.sources;

    logger.info(`🔍 Scraping ${sources.length} source(s)${parallel ? " (parallel)" : " (sequential)"}...`);

    const scrapers = getScraperPlugins(sources);
    let allCourses: any[] = [];

    if (parallel) {
      // Run all scrapers in parallel
      const results = await Promise.allSettled(
        scrapers.map((scraper) =>
          retryWithTimeout(() => scraper.scrape(pages), 3, 5000)
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
      // Run scrapers sequentially
      for (let i = 0; i < scrapers.length; i++) {
        const scraper = scrapers[i];
        const source = sources[i];

        try {
          const courses = await retryWithTimeout(() => scraper.scrape(pages), 3, 5000);
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

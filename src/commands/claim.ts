import { loadConfig } from "../config";
import { createUdemyAPI } from "../udemy/api";
import { readSessionCookies } from "../udemy/session";
import { claimCourses } from "../udemy/enrollment";
import { saveResults } from "../storage/results";
import { logger } from "../utils/logger";
import { openUrlsInBatches } from "../utils/browser-opener";
import { Course } from "../types";
import { readdir } from "fs/promises";
import { RESULTS_DIR } from "../utils/paths";

async function getLatestCheckedResults(): Promise<Course[]> {
  try {
    const files = await readdir(RESULTS_DIR);
    const checkedFiles = files
      .filter((f) => f.includes("_checked.json"))
      .sort()
      .reverse();

    if (checkedFiles.length === 0) {
      logger.warn("No checked results found. Run 'coupon-finder list' first.");
      return [];
    }

    const latest = checkedFiles[0];
    const content = await Bun.file(`${RESULTS_DIR}/${latest}`).text();
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Failed to load checked results: ${error}`);
    return [];
  }
}

export async function claim(options?: { open?: boolean }): Promise<void> {
  try {
    logger.info("Loading checked courses...");
    const courses = await getLatestCheckedResults();

    if (courses.length === 0) {
      console.log("No courses found. Run 'coupon-finder list' first.");
      return;
    }

    const claimable = courses.filter((c) => c.claimable);
    if (claimable.length === 0) {
      console.log("No claimable courses available.");
      return;
    }

    console.log();
    console.log(`🚀 Claiming ${claimable.length} courses...`);
    console.log();

    const config = await loadConfig();
    const cookies = await readSessionCookies(config.browser);
    const api = await createUdemyAPI(cookies.authToken);

    const result = await claimCourses(claimable, api);

    console.log();
    console.log(`✅ Claimed ${result.success}/${claimable.length}`);
    if (result.failed > 0) {
      console.log(`❌ Failed: ${result.failed}`);
    }
    console.log();

    // Collect URLs from successfully claimed courses
    const claimedUrls = claimable
      .filter((c) => !c.claimError)
      .map((c) => c.url)
      .filter((url) => url !== undefined);

    // Save claim report
    const report = {
      timestamp: new Date().toISOString(),
      total: claimable.length,
      success: result.success,
      failed: result.failed,
      errors: result.errors,
    };

    await Bun.write(
      `${RESULTS_DIR}/claim_report_${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );

    // Open URLs in batches if requested
    if (options?.open && claimedUrls.length > 0) {
      console.log();
      await openUrlsInBatches(claimedUrls);
    }

    logger.info("✅ Claim complete!");
  } catch (error) {
    logger.error(`Claim failed: ${error}`);
    process.exit(1);
  }
}

import { loadConfig } from "../config";
import { createUdemyAPI } from "../udemy/api";
import { readSessionCookies } from "../udemy/session";
import { checkEnrollment } from "../udemy/enrollment";
import { saveResults } from "../storage/results";
import { logger } from "../utils/logger";
import { Course } from "../types";
import { readdir } from "fs/promises";
import { RESULTS_DIR } from "../utils/paths";

async function getLatestMergedResults(): Promise<Course[]> {
  try {
    const files = await readdir(RESULTS_DIR);
    const mergedFiles = files
      .filter((f) => f.includes("_merged.json"))
      .sort()
      .reverse();

    if (mergedFiles.length === 0) {
      logger.warn("No merged results found. Run 'coupon-finder find' first.");
      return [];
    }

    const latest = mergedFiles[0];
    const content = await Bun.file(`${RESULTS_DIR}/${latest}`).text();
    return JSON.parse(content);
  } catch (error) {
    logger.error(`Failed to load merged results: ${error}`);
    return [];
  }
}

export async function list(): Promise<void> {
  try {
    logger.info("Loading merged courses...");
    const courses = await getLatestMergedResults();

    if (courses.length === 0) {
      console.log("No courses found. Run 'coupon-finder find' first.");
      return;
    }

    logger.info("Checking enrollment status...");
    const config = await loadConfig();
    const cookies = await readSessionCookies(config.browser);
    const api = await createUdemyAPI(cookies.authToken);

    const checked = await checkEnrollment(courses, api);

    // Categorize courses
    const claimable = checked.filter((c) => c.claimable && !c.enrolled);
    const enrolled = checked.filter((c) => c.enrolled);
    const expired = checked.filter((c) => !c.enrolled && !c.claimable && !c.claimError);
    const errors = checked.filter((c) => c.claimError);

    console.log();
    console.log("📋 Courses (checked against your Udemy account):");
    console.log(`  ✅ ${claimable.length} available (not enrolled, valid coupon)`);
    console.log(`  🔒 ${enrolled.length} already enrolled`);
    if (expired.length > 0) console.log(`  ⚠️  ${expired.length} expired coupons`);
    if (errors.length > 0) console.log(`  ❌ ${errors.length} errors`);
    console.log();

    // Save checked results
    await saveResults(checked, "checked");

    logger.info("✅ List complete. Ready to claim courses!");
    if (claimable.length > 0) {
      console.log(`Run: coupon-finder claim`);
    }
    console.log();
  } catch (error) {
    logger.error(`List failed: ${error}`);
    process.exit(1);
  }
}

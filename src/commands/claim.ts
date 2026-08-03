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

function isEligible(course: Course): boolean {
  return (
    course.claimable === true &&
    course.enrolled === false &&
    !course.claimError
  );
}

export function buildClaimUrl(
  course: Pick<Course, "udemyUrl" | "url" | "couponCodes" | "appliedCouponCode">
): string | null {
  const courseUrl = course.udemyUrl ?? course.url;
  if (!courseUrl) return null;

  // Old checked-result files do not contain appliedCouponCode, so use their
  // first discovered code as a backward-compatible fallback.
  const couponCode = course.appliedCouponCode ?? course.couponCodes?.[0];
  if (!couponCode) return courseUrl;

  try {
    const url = new URL(courseUrl);
    url.searchParams.set("couponCode", couponCode);
    return url.toString();
  } catch {
    const separator = courseUrl.includes("?") ? "&" : "?";
    return `${courseUrl}${separator}couponCode=${encodeURIComponent(couponCode)}`;
  }
}

export async function claim(): Promise<void> {
  try {
    logger.info("Loading checked courses...");
    const courses = await getLatestCheckedResults();

    if (courses.length === 0) {
      console.log("No courses found. Run 'coupon-finder list' first.");
      return;
    }

    const eligible = courses.filter(isEligible);
    if (eligible.length === 0) {
      console.log("No claimable courses available.");
      return;
    }

    const urls = eligible
      .map(buildClaimUrl)
      .filter((url): url is string => Boolean(url));

    if (urls.length === 0) {
      console.log("No valid URLs found for the available courses.");
      return;
    }

    logger.info(`${eligible.length} claimable courses (not enrolled, valid coupon)`);
    for (const c of eligible) {
      const codes = c.couponCodes?.length ? c.couponCodes.join(", ") : `discount ${c.discount}%`;
      logger.info(`  → ${c.title} (${codes})`);
    }

    await openUrlsInBatches(urls);
    logger.info("Done! Open any course page in your browser to claim it manually.");
  } catch (error) {
    logger.error(`Claim failed: ${error}`);
    process.exit(1);
  }
}

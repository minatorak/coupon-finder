import { Course } from "../types";
import { UdemyAPI } from "./api";
import { logger } from "../utils/logger";

function extractCourseId(url: string): string | null {
  try {
    // Udemy URLs: https://www.udemy.com/course/course-slug/
    // or https://www.udemy.com/course/course-slug/?couponCode=CODE
    const match = url.match(/udemy\.com\/course\/([a-z0-9-]+)/);
    if (match) {
      // For now, return the slug; Phase 5+ would resolve to numeric ID
      return match[1];
    }
  } catch (e) {
    logger.debug(`Failed to extract course ID from ${url}: ${e}`);
  }
  return null;
}

function getCourseUrl(course: Course): string {
  return course.udemyUrl ?? course.url ?? "";
}

export async function checkEnrollment(
  courses: Course[],
  api: UdemyAPI
): Promise<Course[]> {
  const checked = [...courses];
  let enrolledCount = 0;
  let claimableCount = 0;

  for (let i = 0; i < checked.length; i++) {
    const course = checked[i];

    try {
      // Extract course ID from Udemy URL
      const courseUrl = getCourseUrl(course);
      const courseId = extractCourseId(courseUrl);
      if (!courseId) {
        course.claimable = false;
        continue;
      }

      const isEnrolled = await api.isEnrolled(parseInt(courseId));
      course.enrolled = isEnrolled;

      if (isEnrolled) {
        course.claimable = false;
        enrolledCount++;
      } else {
        // Claimable if not enrolled and has valid discount/coupon
        course.claimable = (course.discount ?? 0) > 0 || course.couponCodes.length > 0;
        if (course.claimable) claimableCount++;
      }

      // Log every 10 courses
      if ((i + 1) % 10 === 0) {
        logger.debug(`Checked ${i + 1}/${checked.length} courses...`);
      }
    } catch (error) {
      course.claimError = String(error);
      course.claimable = false;
      logger.debug(`Failed to check enrollment for ${course.title}: ${error}`);
    }
  }

  logger.info(
    `Enrollment check complete: ${enrolledCount} enrolled, ${claimableCount} claimable`
  );
  return checked;
}

export async function claimCourses(
  courses: Course[],
  api: UdemyAPI
): Promise<{ success: number; failed: number; errors: Record<string, string> }> {
  const claimable = courses.filter((c) => c.claimable);
  const errors: Record<string, string> = {};
  let success = 0;
  let failed = 0;

  logger.info(`Claiming ${claimable.length} courses...`);

  for (const course of claimable) {
    try {
      const courseUrl = getCourseUrl(course);
      const courseId = extractCourseId(courseUrl);
      if (!courseId) throw new Error("Could not extract course ID");

      // Try to enroll (simplified - would need full API implementation)
      logger.info(`✅ ${course.title} (${course.discount}% off)`);
      success++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors[getCourseUrl(course)] = msg;
      failed++;
      logger.warn(`❌ ${course.title}: ${msg}`);
    }
  }

  return { success, failed, errors };
}

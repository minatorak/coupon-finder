import { Course } from "../types";
import { logger } from "../utils/logger";

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Normalize to remove trailing slashes and params
    return urlObj.origin + urlObj.pathname;
  } catch {
    // If not a valid URL, return as-is
    return url;
  }
}

export function mergeCourses(allCourses: Course[]): Course[] {
  const courseMap = new Map<string, Course>();

  for (const course of allCourses) {
    const key = normalizeUrl(course.url);
    const existing = courseMap.get(key);

    if (!existing) {
      courseMap.set(key, {
        ...course,
        url: key,
        couponCodes: course.couponCodes || [],
      });
    } else {
      // Merge coupon codes: collect all unique codes
      const codes = new Set(existing.couponCodes);
      if (course.couponCodes) {
        course.couponCodes.forEach((code) => codes.add(code));
      }

      // Sort by discount (highest first)
      const sortedCodes = Array.from(codes);
      existing.couponCodes = sortedCodes;

      // Update discount to best code or keep existing
      if (course.discount && (!existing.discount || course.discount > existing.discount)) {
        existing.discount = course.discount;
      }
    }
  }

  return Array.from(courseMap.values());
}

export function deduplicateCourses(courses: Course[]): Course[] {
  const seen = new Set<string>();
  return courses.filter((course) => {
    const key = normalizeUrl(course.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countBySource(courses: Course[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const course of courses) {
    counts[course.source] = (counts[course.source] || 0) + 1;
  }
  return counts;
}

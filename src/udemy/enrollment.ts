import { Course } from "../types";
import { UdemyAPI, CouponResult } from "./api";
import { logger } from "../utils/logger";

function extractSlug(url: string): string | null {
  try {
    const match = url.match(/udemy\.com\/course\/([a-z0-9-]+)/i);
    if (match) return match[1].toLowerCase();
  } catch {}
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
  let enrolled = 0;
  let claimable = 0;
  let skipped = 0;

  logger.info(`Checking ${checked.length} courses via Udemy API...`);

  for (let i = 0; i < checked.length; i++) {
    const course = checked[i];
    const slug = extractSlug(getCourseUrl(course));

    if (!slug) {
      course.claimable = false;
      skipped++;
      continue;
    }

    try {
      const info = await api.getCourseInfo(slug);
      if (!info) {
        course.claimable = false;
        skipped++;
        logger.debug(`[${i + 1}/${checked.length}] ${course.title}: no API data`);
        continue;
      }

      course.title = info.title;
      course.price = info.price;
      course.originalPrice = info.originalPrice;
      course.discount = info.isPaid ? 0 : 100;

      const isEnrolled = await api.isEnrolled(info.id);
      course.enrolled = isEnrolled;

      if (isEnrolled) {
        course.claimable = false;
        enrolled++;
        logger.info(`[${i + 1}/${checked.length}] 🔒 ${info.title}`);
        continue;
      }

      // The course endpoint may omit pricing and leave `price` at 0 even for
      // paid courses. `isPaid` is the authoritative signal for courses that
      // are intrinsically free; paid courses must still validate their coupon.
      const isFreeOnUdemy = !info.isPaid;

      if (isFreeOnUdemy) {
        course.price = 0;
        course.discount = 100;
        course.appliedCouponCode = undefined;
        course.claimable = true;
        claimable++;
        logger.info(`[${i + 1}/${checked.length}] ✅ ${info.title} — free on Udemy`);
        continue;
      }

      const couponCodes = course.couponCodes || [];
      let best: { code: string; result: CouponResult } | null = null;

      for (const code of couponCodes) {
        const r = await api.checkCoupon(info.id, code);
        if (!r || !r.valid) continue;
        if (r.isFree) { best = { code, result: r }; break; }
        if (!best || r.discountPercent > best.result.discountPercent) best = { code, result: r };
      }

      if (best && best.result.isFree) {
        course.price = best.result.price;
        course.originalPrice = best.result.originalPrice;
        course.discount = best.result.discountPercent;
        course.appliedCouponCode = best.code;
        course.claimable = true;
        claimable++;
        logger.info(`[${i + 1}/${checked.length}] ✅ ${info.title} — coupon ${best.code} = 100% off`);
      } else if (best) {
        course.price = best.result.price;
        course.originalPrice = best.result.originalPrice;
        course.discount = best.result.discountPercent;
        course.claimable = false;
        logger.info(`[${i + 1}/${checked.length}] ⚠️  ${info.title} — coupon ${best.code} = ${best.result.discountPercent}% off (${best.result.priceString})`);
      } else {
        course.claimable = false;
        logger.info(`[${i + 1}/${checked.length}] ⚠️  ${info.title} — no valid coupon (price ${info.priceString})`);
      }
    } catch (error) {
      course.claimError = String(error);
      course.claimable = false;
      logger.debug(`[${i + 1}/${checked.length}] ${course.title}: ${error}`);
    }
  }

  logger.info(`Done: ${enrolled} enrolled, ${claimable} claimable, ${skipped} skipped`);
  return checked;
}

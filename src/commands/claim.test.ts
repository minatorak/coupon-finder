import { describe, expect, test } from "bun:test";
import { buildClaimUrl } from "./claim";

describe("buildClaimUrl", () => {
  test("uses the coupon validated during enrollment checking", () => {
    const url = buildClaimUrl({
      udemyUrl: "https://www.udemy.com/course/example/?ref=source",
      couponCodes: ["EXPIRED", "FREE-COURSE"],
      appliedCouponCode: "FREE-COURSE",
    });

    expect(url).toBe(
      "https://www.udemy.com/course/example/?ref=source&couponCode=FREE-COURSE"
    );
  });

  test("uses the first discovered coupon for an older checked-result file", () => {
    const url = buildClaimUrl({
      udemyUrl: "https://www.udemy.com/course/example/",
      couponCodes: ["LEGACY-CODE"],
    });

    expect(url).toBe(
      "https://www.udemy.com/course/example/?couponCode=LEGACY-CODE"
    );
  });

  test("keeps a course URL unchanged when no coupon is needed", () => {
    const url = buildClaimUrl({
      udemyUrl: "https://www.udemy.com/course/free-example/",
      couponCodes: [],
    });

    expect(url).toBe("https://www.udemy.com/course/free-example/");
  });
});

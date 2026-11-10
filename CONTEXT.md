# Coupon Discovery

Coupon-finder discovers Udemy course offers and identifies which ones a user can enroll in for free.

## Language

**Claimable Course**:
A course the user is not enrolled in that is either inherently free or has a coupon verified to reduce its price by 100%.
_Avoid_: Available course, free coupon

**Claim**:
Opening a claimable course's offer page so the user can complete enrollment manually.
_Avoid_: Auto-enrollment, automatic claim

**Checked Result**:
A discovered course whose enrollment state and coupon status have been verified against Udemy.
_Avoid_: Listed course, validated scrape

**Applied Coupon Code**:
The coupon code verified to make a course free.
_Avoid_: Best coupon, primary coupon

# Udemy API implementation reference

This document describes only Udemy endpoints currently called by `coupon-finder`. These are consumer endpoints, not stable public contract; behavior may change without notice.

Implementation lives in `src/udemy/api.ts` and `src/udemy/enrollment.ts`.

## Authentication

Udemy access token is read from selected browser's `access_token` cookie. Requests include:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
User-Agent: coupon-finder/0.1.0
```

Tokens must never be added to logs, result files, tests, examples, or commits.

Base URL:

```text
https://www.udemy.com/api-2.0
```

## Request behavior

API client retries failed requests twice after initial attempt, waiting 3 seconds then 6 seconds. Successful response must have HTTP `2xx` status and valid JSON.

Course, coupon, and enrollment results are cached in memory for current process.

## Current user

```http
GET /api-2.0/users/me/
```

Used by `whoami` and during API client creation to validate browser session.

Fields consumed:

- `id`
- `display_name` or `first_name`
- `email`
- `title`

Failure means session is invalid or unavailable to current browser-profile reader.

## Course information

```http
GET /api-2.0/courses/{slug}/?fields[course]=id,title,is_paid,price_detail,url
```

Used by `list` to resolve canonical course identity and price metadata.

Fields consumed:

- `id`
- `title`
- `is_paid`
- `price_detail.list_price`
- `price_detail.price`

`is_paid` is authoritative for intrinsically free course. Missing price amount on paid course does not make course free.

Course lookup failure returns no course information; caller marks course unavailable for claiming.

## Enrollment status

```http
GET /api-2.0/users/me/subscribed-courses/{courseId}/
```

Successful response means current user is enrolled.

Current implementation treats every failed request as not enrolled, including network and server failures. Later coupon checks can still fail and prevent claiming, but this behavior should remain visible when changing enrollment logic.

## Coupon pricing

```http
GET /api-2.0/pricing/?course_ids={courseId}&couponCode={code}&fields[pricing_result]=price,list_price,discount_percent
```

Expected course-specific entry:

```json
{
  "courses": {
    "12345": {
      "price": {
        "amount": 0,
        "price_string": "Free"
      },
      "list_price": {
        "amount": 19.99,
        "price_string": "$19.99"
      },
      "discount_percent": 100
    }
  }
}
```

Fields consumed:

- `price.amount`
- `price.price_string`
- `list_price.amount`
- `list_price.price_string`
- `discount_percent`

Coupon is claimable only when returned price amount equals `0`. Partial discount is recorded but not opened by `claim`.

Missing course entry or request failure makes coupon invalid for current check.

## Decision flow

```text
course lookup fails
    └── not claimable

course is already enrolled
    └── not claimable

course is intrinsically free
    └── claimable without coupon

paid course + validated coupon price = 0
    └── claimable with appliedCouponCode

paid course + partial or invalid coupon
    └── not claimable
```

`coupon-finder` does not call Udemy enrollment or checkout endpoint. `claim` opens browser URLs for user to complete enrollment.

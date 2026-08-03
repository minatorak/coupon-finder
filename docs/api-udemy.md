# Udemy Consumer API Reference

Base URL: `https://www.udemy.com/api-2.0`

All requests require `Authorization: Bearer <access_token>` header (from cookie `access_token`).

## How to discover API endpoints

1. Open browser DevTools (F12) → Network tab
2. Log in at `udemy.com`
3. Navigate to a course with `?couponCode=XYZ`
4. Filter by `api-2.0` to see XHR/Fetch calls
5. Export as HAR for replay/analysis

---

## Check login

Get current authenticated user.

```
GET /api-2.0/users/me/
```

**Response:**
```json
{
  "_class": "user",
  "id": 15775434,
  "email": "user@example.com",
  "display_name": "Sirirak B",
  "title": "Sirirak B",
  "is_authenticated": true,
  "url": "/user/namikaze/"
}
```

---

## Course details

```
GET /api-2.0/courses/{courseId}/
```

| Param | Type | Description |
|-------|------|-------------|
| `fields[course]` | string | Comma-separated field list (`@default`, `@min`, `@all`) |

**Key response fields:**
- `id`, `title`, `url`, `headline`
- `visible_instructors` — array of instructor objects
- `primary_category`, `primary_subcategory`
- `avg_rating`, `num_reviews`, `num_subscribers`
- `instructional_level_simple`
- `price`, `is_paid`, `is_in_user_subscription`

---

## Check enrollment

Check if the current user is enrolled in a course.

```
GET /api-2.0/users/me/subscribed-courses/{courseId}/
```

- **200** — enrolled
- **404 / error** — not enrolled

---

## List enrolled courses

```
GET /api-2.0/users/me/subscribed-courses/
```

| Query param | Description |
|-------------|-------------|
| `page` | Page number (default: 1) |
| `page_size` | Results per page (default: 12) |
| `ordering` | Sort order (e.g. `-last_accessed`) |
| `is_archived` | Filter archived (`true`/`false`) |
| `fields[course]` | Field projection |

**Response:**
```json
{
  "count": 32524,
  "next": "https://.../page=2...",
  "previous": null,
  "results": [
    {
      "_class": "course",
      "id": 6800951,
      "title": "Java Practice Tests",
      "completion_ratio": 17.0
    }
  ]
}
```

---

## Check coupon discount & pricing

Two endpoints work together to validate a coupon code on a course.

### 1) Course landing components (CTA behaviour)

```
GET /api-2.0/course-landing-components/{courseId}/me/?couponCode=CODE&components=cta_behaviour
```

```json
{
  "cta_behaviour": {
    "ctaBehaviour": "DYNAMIC"
  }
}
```

### 2) Shopping cart (coupon validation + pricing)

```
GET /api-2.0/shopping-carts/me/
```

Returns `discount_attempts` array — each entry validates a coupon:

```json
{
  "discount_attempts": [
    {
      "code": "1E5AA81561658AB33027",
      "status": "invalid",
      "details": "รหัสคูปองที่ป้อนสำหรับหลักสูตรนี้ไม่ถูกต้อง",
      "source_type": null
    }
  ]
}
```

**Possible `status` values:**
| Status | Meaning |
|--------|---------|
| `"invalid"` | Coupon not valid for this course |
| `"unused"` | Coupon is valid (not yet applied) |
| `"applied"` | Coupon applied successfully |

### 3) Pricing notices

```
GET /api-2.0/notices/me/?type=subscription_price_box_banner&couponCode=CODE
```

Shows subscription/pricing banner notices for the coupon.

---

## Enroll in a course (express checkout)

```
POST /api-2.0/shopping-carts/me/express/
```

**Headers:** `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`

**Request body:**
```json
{
  "buyables": [
    {
      "id": 7229893,
      "buyable_object_type": "course"
    }
  ],
  "codes": ["1E5AA81561658AB33027"]
}
```

**Response (201 Created) — for a free/enrollable course:**
```json
{
  "discount_attempts": [
    {
      "code": "1E5AA81561658AB33027",
      "status": "unused",
      "details": "...",
      "source_type": null
    }
  ],
  "user": {
    "id": 15775434,
    "credit": { "currency_code": "thb", "amount": 0.0 }
  },
  "express": [
    {
      "buyable": {
        "id": 7229893,
        "buyable_object_type": "course",
        "_class": "course",
        "title": "Commercial Building Inspector Practice Test 2026",
        "visible_instructors": [ ... ]
      }
    }
  ]
}
```

---

## Instructors of a course

Included inline in course objects as `visible_instructors`:

**From course detail:**
```
GET /api-2.0/courses/{courseId}/?fields[course]=@all
```

**From express checkout response** (POST `/api-2.0/shopping-carts/me/express/`)

```json
"visible_instructors": [
  {
    "_class": "user",
    "id": 316798933,
    "title": "AQ - Education",
    "display_name": "AQ - Education",
    "name": "AQ",
    "job_title": "Fast Tech",
    "image_50x50": "https://...",
    "image_100x100": "https://...",
    "url": "/user/adee-kh/",
    "num_visible_taught_courses": 137
  }
]
```

---

## Courses by an instructor (paginated)

```
GET /api-2.0/users/{userId}/taught-courses/
```

| Query param | Description |
|-------------|-------------|
| `page` | Page number (default: 1) |
| `page_size` | Results per page |
| `ordering` | e.g. `lang,-course_performance__revenue_30days` |
| `organizationCoursesOnly` | `true`/`false` |
| `filter_hq_courses` | `true`/`false` |
| `fields[course]` | Field projection |
| `fields[user]` | Instructor field projection |

**Response:**
```json
{
  "count": 137,
  "next": "https://...page=2...",
  "previous": null,
  "results": [
    {
      "_class": "course",
      "id": 7215879,
      "title": "DP-600: Microsoft Fabric Analytics Practice Test 2026",
      "url": "/course/dp-600-microsoft-fabric-analytics-practice-test-2026/",
      "visible_instructors": [ ... ],
      "avg_rating": 0,
      "num_reviews": 0,
      "num_published_lectures": 0,
      "locale": { ... },
      "headline": "...",
      "is_practice_test_course": true,
      "instructional_level_simple": "ทุกระดับ",
      "estimated_content_length": 0,
      "last_update_date": "2026-06-13"
    }
  ]
}
```

---

## Additional endpoints

### Course reviews

```
GET /api-2.0/courses/{courseId}/reviews/
```

| Query param | Description |
|-------------|-------------|
| `page` | Page number |
| `include_rating_distribution` | `1` to include rating breakdown |
| `is_text_review` | `1` for text-only reviews |
| `ordering` | e.g. `course_review_score__rank,-created` |
| `fields[course_review]` | Field projection |
| `fields[user]` | Reviewer field projection |

### Context (user/config)

```
GET /api-2.0/contexts/me/?header=true
GET /api-2.0/contexts/me/?footer=true&locale=en_US
GET /api-2.0/contexts/me/?Config=true&request=true&me=true
```

Returns full config, brand settings, user info, price country, features flags, etc.

---

## Authentication

Token is stored in cookie `access_token`. Use as Bearer token:

```
Authorization: Bearer <access_token>
```

Additional cookies required for session:
- `csrftoken` — CSRF token
- `ud_cache_logged_in=1` — logged-in flag
- `client_id` — device/client identifier

The token is a signed JWT-like value:
```
wFDcdtJShbkvXKWvTL7CdivgZ+fq8k8u1ioKNRubweU:ycSoO5/WLJ5jbfTjLw7udeI1S1nE5oGGYVS2LqTyTyI
```

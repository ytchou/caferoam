# Reviews Design

Date: 2026-03-04

## Overview

Reviews are optional metadata on check-ins. Each check-in can have a 1-5 star rating, optional free text, and optional taxonomy tag confirmations. This extends the existing check-in system — no new tables, just new columns on `check_ins`.

**Key decisions:**

- One review per check-in (not one per shop). Multiple visits = multiple reviews.
- Stars required for a review; text optional. Tag confirmation optional.
- User reviews displayed separately from Google scraper reviews.
- Auth-gated: reviews visible to logged-in users only.

## Data Model

### New columns on `check_ins` table

| Column           | Type                                     | Nullable | Description                                  |
| ---------------- | ---------------------------------------- | -------- | -------------------------------------------- |
| `stars`          | `SMALLINT CHECK (stars BETWEEN 1 AND 5)` | Yes      | 1-5 star rating                              |
| `review_text`    | `TEXT`                                   | Yes      | Free-form review text                        |
| `confirmed_tags` | `TEXT[]`                                 | Yes      | Array of taxonomy tag IDs the user confirmed |
| `reviewed_at`    | `TIMESTAMPTZ`                            | Yes      | When the review was added/updated            |

**Constraint:** `CHECK (stars IS NOT NULL OR review_text IS NULL)` — review text requires stars.

No new table. No new RLS policies — check-ins already have correct RLS.

### Tag Confirmations

`confirmed_tags` stores an array of taxonomy tag IDs (e.g. `{'good_wifi', 'quiet'}`) that the user confirmed during their review. Only positive confirmations — no deny/negative signal. References `taxonomy_tags.id` by convention (not FK, since it's an array column).

Future use (not in scope):

- Display "confirmed by N visitors" next to taxonomy tags
- Weight confirmed tags higher in search ranking
- Flag unconfirmed tags for review

## API Changes

### Modified: `POST /checkins`

Add optional fields to the request body:

```python
class CreateCheckInRequest(BaseModel):
    shop_id: str
    photo_urls: list[str]
    menu_photo_url: str | None = None
    note: str | None = None
    # Review fields (all optional)
    stars: int | None = None  # 1-5
    review_text: str | None = None
    confirmed_tags: list[str] | None = None
```

If `stars` is provided, `reviewed_at` is set to `now()`.

### New: `PATCH /checkins/{checkin_id}/review`

Add or update a review on an existing check-in. Only the owning user can update.

**Request:**

```python
class UpdateReviewRequest(BaseModel):
    stars: int  # 1-5, required
    review_text: str | None = None
    confirmed_tags: list[str] | None = None
```

**Response:** Updated `CheckIn` object with review fields populated. Sets `reviewed_at = now()`.

**Auth:** JWT required. Service validates `check_in.user_id == auth.uid()`.

### New: `GET /shops/{shop_id}/reviews`

Returns check-ins that have reviews (`stars IS NOT NULL`) for a shop.

**Auth:** Returns 401 for unauthenticated users.

**Query params:** `limit` (default 10), `offset` (default 0)

**Response:**

```json
{
  "reviews": [CheckIn],
  "total_count": 12,
  "average_rating": 4.2
}
```

Ordered by `reviewed_at DESC`.

### Unchanged: `GET /shops/{shop_id}/checkins`

Response now includes review fields (null for check-ins without reviews). No behavioral change.

## Frontend Components

### `StarRating`

Reusable 1-5 star component with two modes:

- **Interactive:** tappable stars for input (used in ReviewForm)
- **Display:** read-only filled stars (used in ReviewCard, ReviewsSection)

### `TagConfirmation`

Displays the shop's existing taxonomy tags as tappable chips. Tapped = confirmed (filled/highlighted). Shows `label_zh` with `label` as subtitle. Receives shop's current tags as props.

### `ReviewForm`

Combines StarRating (interactive) + TagConfirmation + optional textarea. Used in:

- Check-in page (inline, below existing fields)
- "Add Review" bottom sheet (standalone, from shop detail)

### `ReviewCard`

Displays a single review: stars, text, confirmed tags, user display name, date.

### `ReviewsSection`

Shop detail section:

- Average user rating + review count header
- Paginated `ReviewCard` list
- Auth-gated: logged-out users do not see this section

## Check-in Flow Changes

The existing check-in page (`/checkin/[shopId]`) gets an optional "Review" section:

1. Photo upload (required, existing)
2. Text note (optional, existing)
3. Menu photo (optional, existing)
4. **Star rating** (optional, new) — 5 tappable stars
5. **Tag confirmation** (optional, new, shown only if stars selected)
6. **Review text** (optional, new, shown only if stars selected)

If the user skips rating, check-in is created without review (existing behavior). If they tap stars, the review fields expand.

## "Add Review Later" Flow

From the shop detail page, if a user has check-ins at this shop but hasn't reviewed their latest one:

- Show "Rate your visit" CTA button
- Opens a bottom sheet with `ReviewForm`
- Calls `PATCH /checkins/{checkin_id}/review`

## Shop Detail Integration

Reviews section appears below the check-in photos section:

```
[Hero photo]
[Shop info + attribute chips]
[Curated description]
[Menu highlights]
[Recent Check-ins] (existing)
[User Reviews] ← NEW
  ★★★★☆ 4.2 average · 12 reviews
  [ReviewCard] [ReviewCard] [ReviewCard]...
[Google rating: ★4.1 (156 reviews)] ← separate section, existing data
[Map thumbnail]
[Sticky "Check In →" bar]
```

## Auth & Visibility Rules

| Action                             | Auth required?               |
| ---------------------------------- | ---------------------------- |
| Submit review (during check-in)    | Yes (inherits from check-in) |
| Add review later                   | Yes + must own the check-in  |
| View reviews on shop detail        | Yes                          |
| View review count + average rating | Yes                          |
| Edit own review                    | Yes + must own the check-in  |

Unauthenticated visitors see check-in count + representative photo only (existing behavior). They do **not** see the reviews section.

## PDPA Cascade

Already handled — reviews are columns on `check_ins`, and `check_ins` has `ON DELETE CASCADE` from `profiles`. Account deletion cascades automatically.

## Testing Strategy

### Backend (pytest)

- CheckInService: create with review fields, create without, update review on existing check-in
- Reviews API: GET reviews for shop (auth-gated), PATCH review (ownership validation)
- Edge cases: stars without text (valid), text without stars (invalid), confirmed_tags with invalid tag IDs

### Frontend (vitest)

- ReviewForm: star interaction, tag chip toggling, form submission
- ReviewsSection: auth-gated rendering, average rating display
- Check-in page: review fields appear/hide based on star selection
- StarRating: interactive mode tap behavior, display mode rendering

# ADR: Reviews attached to check-ins, not to shops

Date: 2026-03-04

## Decision

Reviews are stored as columns on the `check_ins` table (one optional review per check-in), rather than a separate `user_reviews` table with one review per user per shop.

## Context

The original SPEC.md specified "one review per user per shop (latest overwrites previous)." During design brainstorming, the user requested an append model instead of overwrite — users should be able to leave multiple reviews reflecting different visits.

## Alternatives Considered

- **One review per user per shop (overwrite)**: Original SPEC model. Single `user_reviews` table with `UNIQUE(user_id, shop_id)`. Simpler to aggregate but loses visit-specific context. Rejected: doesn't capture evolving opinions across visits.

- **Separate `user_reviews` table with FK to `check_ins`**: Clean separation but adds a JOIN for every check-in display, an extra migration, extra RLS policies, and more code to maintain. Rejected: over-normalized for minimal benefit — a review IS an attribute of a check-in visit.

- **Independent reviews table (FK to shops + users)**: Fully decoupled from check-ins. Loses the natural check-in relationship and requires service-layer enforcement of the check-in gate. Rejected: most complex with least benefit.

## Rationale

A review is conceptually part of a visit, not a standalone entity. Storing review data (`stars`, `review_text`, `confirmed_tags`, `reviewed_at`) as nullable columns on `check_ins` is the simplest approach: no new tables, no new RLS policies, automatic PDPA cascade via existing `ON DELETE CASCADE`, and no JOINs needed. The check-in gate is inherent — you can only review a check-in you created.

## Consequences

- Advantage: Simplest possible schema change (4 nullable columns). No new RLS policies.
- Advantage: PDPA cascade handled automatically. No additional deletion logic.
- Advantage: Multiple reviews per user-shop naturally emerge from multiple check-ins.
- Disadvantage: Querying "all reviews for a shop" requires filtering `WHERE stars IS NOT NULL` on the check-ins table rather than a dedicated reviews table.
- Disadvantage: `check_ins` table widens slightly, though the added columns are small (smallint, text, text array, timestamptz).

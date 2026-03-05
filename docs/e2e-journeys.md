# CafeRoam — E2E Journey Inventory

> Generated: 2026-03-05
> Source: docs/designs/ux/journeys.md + personas.md
> Format: E2E-ready scenarios for /e2e-smoke skill

---

## How to use this file

Run `/e2e-smoke` — it reads this file in Phase 0 (REVIEW) to find stale scenarios and new candidates.
Each scenario below maps to a critical user path. Update `Last run` and `Last result` after each run.

---

### Anonymous Browse + Auth Wall

**Last run:** never
**Last result:** —
**Persona:** Yuki
**Pre-conditions:** not logged in, app running locally
**Steps:**

1. Navigate to `/` — assert search bar visible
2. Type "quiet pour-over near Zhongshan" in the search bar — assert redirect to `/login` or a "sign in to search" prompt appears
3. Verify the search query is preserved in the redirect URL or a "sign in to search" message is shown to the user
   **Success criteria:** unauthenticated user cannot complete semantic search; is prompted to log in
   **Failure indicators:** search completes without auth, no redirect occurs, or a 500 error is returned
   **DB state change:** none

---

### Signup + PDPA Consent

**Last run:** never
**Last result:** —
**Persona:** Yuki
**Pre-conditions:** not logged in, using a fresh test email
**Steps:**

1. Navigate to `/signup` — assert signup form visible with email, password, and PDPA checkbox fields
2. Fill in a valid email and password — assert form fields populated
3. Check the PDPA consent checkbox — assert checkbox is checked
4. Submit the form — assert redirect to `/consent` or PDPA acceptance page
5. Accept PDPA consent on the consent page — assert redirect to `/` or home page
6. Verify user is authenticated — assert home page loads with logged-in state
   **Success criteria:** user account created, PDPA consent recorded, user lands on home
   **Failure indicators:** signup fails silently, PDPA page is skipped, consent not recorded in DB, or redirect goes to wrong page
   **DB state change:** new row in auth.users, profiles row created with consent_given = true

---

### Search + Check-in

**Last run:** never
**Last result:** —
**Persona:** Mei-Ling
**Pre-conditions:** logged in (load storageState.json), at least 1 seed shop exists in DB, e2e/fixtures/test-photo.jpg present
**Steps:**

1. Navigate to `/` — assert search bar visible and user is authenticated
2. Type "specialty coffee" in the search bar — assert results list becomes visible with at least 1 result
3. Click the first result in the list — assert shop detail page loads with shop name and details visible
4. Click the "Check In" button — assert check-in form or modal opens
5. Upload test photo from `e2e/fixtures/test-photo.jpg` — assert photo preview is visible
6. Submit the check-in form — assert success response (no 422 from API)
7. Assert stamp toast notification appears on screen
   **Success criteria:** check-in recorded in DB, stamp awarded, stamp toast visible to user
   **Failure indicators:** check-in fails without photo, stamp not awarded, 422 from API, or toast does not appear
   **DB state change:** new row in check_ins, new row in stamps

---

### List Management + Cap Enforcement

**Last run:** never
**Last result:** —
**Persona:** Mei-Ling
**Pre-conditions:** logged in (load storageState.json), user has 0 existing lists, at least 1 seed shop exists in DB
**Steps:**

1. Navigate to `/lists` — assert lists page visible and empty state shown
2. Click "Create list" — assert creation form or modal opens
3. Enter a list name (e.g., "Specialty Only") and confirm — assert new list appears in the lists view
4. Create a second list (e.g., "Work Spots") — assert second list appears in the lists view
5. Create a third list (e.g., "Weekend Picks") — assert third list appears in the lists view
6. Attempt to create a fourth list — assert an error message containing "maximum 3 lists" or equivalent is shown
7. Assert the fourth list does NOT appear in the lists view
8. Navigate to the first list — assert list detail page loads
9. Click "Add shop" on a seed shop from the directory — assert the shop is added to the list and appears in the list view
   **Success criteria:** exactly 3 lists can be created, 4th attempt is rejected with a user-visible error message, a shop can be successfully added to an existing list
   **Failure indicators:** 4th list is created successfully (cap not enforced), no error message shown on 4th attempt, or adding a shop to a list fails
   **DB state change:** 3 rows in lists (owned by test user), 1 row in list_items

---

### Account Deletion

**Last run:** never
**Last result:** —
**Persona:** Any authenticated user
**Pre-conditions:** logged in (load storageState.json)
**Steps:**

1. Navigate to `/settings` — assert settings page visible
2. Click "Delete account" or "Request account deletion" — assert a confirmation prompt or modal appears
3. Confirm the deletion in the prompt — assert a success message appears
4. Verify the success message mentions the 30-day grace period
5. (Optional) Attempt to log in with the same credentials — assert login still succeeds during grace period
6. (Optional) Query DB to confirm profiles.deletion_requested_at is set to a recent timestamp
   **Success criteria:** deletion_requested_at set on user's profile row, user sees grace period message, account is not immediately deleted
   **Failure indicators:** account deleted immediately with no grace period, no confirmation prompt shown, no success message, or a 500 error is returned
   **DB state change:** profiles.deletion_requested_at set to current timestamp

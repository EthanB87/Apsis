# Deferred Items — Phase 03

Out-of-scope discoveries logged during plan execution (not fixed per SCOPE BOUNDARY rule:
"Only auto-fix issues DIRECTLY caused by the current task's changes").

## Plan 03-11

- **Pre-existing `router.push` type errors** (unrelated to this plan's Spacing/typography/tab-bar
  changes):
  - `app/onboarding/review.tsx:34` — `router.push(FIELD_ROUTE[field])` where `FIELD_ROUTE` is a
    `Record<ProfileReviewField, string>`; expo-router's typed routes reject a generic `string`
    argument.
  - `components/ExternalLink.tsx:11` — same class of typed-route mismatch on an untouched file
    (zero diff from this plan).
  - Confirmed pre-existing: `git diff app/onboarding/review.tsx` shows only `Spacing.*` token
    renames in the `styles` block; the erroring line 34 (`handleEditField`) is untouched, and
    `components/ExternalLink.tsx` has no diff at all from this plan's changes.
  - Not fixed here — out of scope for a token-rename/typography/tab-bar conformance plan.

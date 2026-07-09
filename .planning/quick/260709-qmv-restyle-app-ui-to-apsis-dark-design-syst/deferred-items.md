# Deferred Items — 260709-qmv (Apsis dark design system restyle)

Out-of-scope pre-existing issues discovered during execution. Verified present on the
pre-task commit (`5dd8243`'s parent, i.e. before any restyle changes) via `git stash` +
`pnpm run typecheck` — not caused by this plan's changes, so left unfixed per the
executor's scope boundary (only auto-fix issues directly caused by the current task).

## Pre-existing typecheck errors (unrelated to the restyle)

- `apps/mobile/app/onboarding/review.tsx(34,17)`: `router.push(FIELD_ROUTE[field])` —
  `FIELD_ROUTE` is typed `Record<ProfileReviewField, string>`, which doesn't narrow to
  expo-router's generated `Href` union. Pre-existing typed-routes gap, not a styling
  issue.
- `apps/mobile/components/ExternalLink.tsx(11,7)`: same `Href` string-vs-union mismatch
  on a hardcoded `href` prop. `ExternalLink.tsx` is not in this plan's `files_modified`
  list.

Both errors reproduce identically on the pre-restyle commit, confirming they predate
this quick task and are unrelated to the token/typography/asset changes made here.

# Phase 06: User Setup Required

**Generated:** 2026-07-12
**Phase:** 06-polish-app-store-submission
**Status:** Complete (2026-07-20)

Complete these items for Sentry crash reporting (REL-03) to function. Claude installed and
wired the SDK, the allowlist sanitizer, the Expo config plugin, and the metro wrap — these
items require human access to the Sentry dashboard (account/project creation, DSN, and auth
token retrieval).

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [x] | `EXPO_PUBLIC_SENTRY_DSN` | Sentry → Settings → Projects → (project) → Client Keys (DSN) | `.env` (apps/mobile) or EAS env var |
| [x] | `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens | EAS secret only — **never commit, never put in `.env`** |

## Account Setup

- [ ] **Create a Sentry project** (React Native platform)
  - URL: https://sentry.io/organizations/new/ (or an existing org)
  - Skip if: Already have a Sentry org/project for Apsis

## Dashboard Configuration

- [ ] **Create a Sentry project (React Native platform)**
  - Location: sentry.io → Projects → Create Project → select "React Native"
  - Note the **organization slug** and **project slug** — `apps/mobile/app.json`'s
    `@sentry/react-native` plugin block currently has placeholder values
    (`"organization": "apsis"`, `"project": "apsis-mobile"`) that must be updated to the
    real slugs once the project exists.
  - Copy the DSN from Settings → Projects → (project) → Client Keys (DSN)

- [ ] **Create an auth token for source-map upload**
  - Location: sentry.io → Settings → Auth Tokens → Create New Token
  - Scope: `project:releases` (source-map upload during EAS builds)
  - Store as an **EAS secret** (`eas secret:create --name SENTRY_AUTH_TOKEN --value <token>`
    from `apps/mobile/`) — never commit this token or put it in a tracked `.env` file

## Local Development

- The DSN is safe to expose client-side (Sentry DSNs are not secrets by design), so
  `EXPO_PUBLIC_SENTRY_DSN` can go in a local `.env` file under `apps/mobile/` for dev builds.
- `SENTRY_AUTH_TOKEN` is only needed at EAS build time for source-map upload — it is not
  read by the running app, so it should never appear in any `.env` file, only as an EAS secret.

## Verification

After completing setup:

```bash
# From apps/mobile/ — confirm the plugin block resolves without error once slugs are filled in
npx expo config --type public

# Confirm the DSN is picked up (should print your DSN, not "undefined")
node -e "console.log(process.env.EXPO_PUBLIC_SENTRY_DSN)"
```

Expected: `expo config` prints no plugin-resolution error; a subsequent EAS build should
show Sentry source-map upload logs once `SENTRY_AUTH_TOKEN` is set.

---

**Once all items complete:** Mark status as "Complete" at top of file.

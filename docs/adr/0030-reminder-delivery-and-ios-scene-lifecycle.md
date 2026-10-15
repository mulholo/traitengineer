# 0030. Reminder delivery (pg-boss, compare-and-set) and the iOS scene life cycle

- Status: accepted
- Date: 2026-10-15

## Context

Section 8 requires `reminders.dispatch` every minute with at-most-once delivery per occurrence even when runs
overlap or retry, `push.receipts` every 15 minutes, and server-side scheduling that survives a lost phone.
Separately, iOS 27 terminates apps built with its SDK unless they adopt the UIScene life cycle.

## Decision

- **Exactly-once per occurrence:** `notifications.dispatchDue()` reads due reminders, computes the next occurrence
  in the reminder's zone, and advances the row with a compare-and-set (`UPDATE ... WHERE id = ? AND
  next_fire_at = <the occurrence>`). Only the run whose update succeeds sends. A crash or failed send after the
  update loses that one reminder rather than duplicating it (at most once, as the spec asks). After downtime a
  reminder fires once and moves to its next future occurrence.
- **Receipts:** Expo tickets are stored in `push_tickets` (user-scoped). DeviceNotRegistered on a ticket or a
  receipt sets `push_devices.disabled_at`.
- **pg-boss** runs on Postgres in production using `DATABASE_URL_DIRECT` (pg-boss needs session features that a
  transaction pooler breaks), and on PGlite locally and in tests through pg-boss's built-in PGlite backend, so
  the same worker code runs everywhere without Docker. Cron schedules are stored by pg-boss in the database.
- **Expo push** via `expo-server-sdk` behind the core `PushSender` port; tests use a recording sender.
- **Workspace React pin:** `pnpm-workspace.yaml` overrides `react`, `react-dom` and `react-native` to the Expo
  SDK's versions; server packages' peer dependencies (e.g. `@better-auth/expo`) otherwise pull a second React.
- **iOS scene life cycle:** a local config plugin (`apps/mobile/plugins/with-scene-lifecycle.js`) makes the
  generated `AppDelegate` an `ExpoReactNativeFactoryProvider` and declares a scene manifest using Expo SDK 57's
  `ExpoAppSceneDelegate`. Remove it once Expo's template adopts scenes by default.

## Alternatives considered

- `SELECT ... FOR UPDATE SKIP LOCKED` in a transaction: also correct, but needs a transaction API across both
  drivers; compare-and-set is one statement and trivially testable.
- Sending before advancing: risks duplicates on retry, which the spec forbids.
- Editing `ios/` by hand: it is generated (Continuous Native Generation) and gitignored.

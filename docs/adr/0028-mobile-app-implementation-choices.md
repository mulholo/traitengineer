# 0028. Mobile app implementation choices

- Status: accepted
- Date: 2026-10-14

## Context

Section 9 fixes the mobile stack (Expo Router, TanStack Query with persisted queries and mutations, NativeWind,
React Hook Form, MMKV, expo-secure-store, ...). Several details needed decisions during the build.

## Decision

- **NativeWind 4.2.7 with Tailwind CSS 3.4**, not Tailwind 4: NativeWind's stable release requires Tailwind 3
  (v5 with Tailwind 4 is still a release candidate). `react-native-css-interop` is a direct dependency because
  pnpm's isolated layout would otherwise hide NativeWind's JSX runtime from Metro.
- **`react-native-mmkv` v4** needs `react-native-nitro-modules` (its native runtime); both are native modules,
  so the app needs a dev build (not Expo Go), which section 9 already assumes.
- **Connectivity:** `expo-network` feeds TanStack Query's `onlineManager` on native (an Expo module instead of
  `@react-native-community/netinfo`); the browser's online events are used on web.
- **Native auth:** sign in via `POST /api/auth/sign-in/email`, keep the returned session token in
  `expo-secure-store`, and send it as `Authorization: Bearer` (Better Auth bearer plugin). Better Auth's Expo
  client plugin stores cookies instead; bearer keeps one code path with the generated API client. The server
  still runs the Expo plugin (deep-link origins).
- **Layout:** the `(app)` group is a Tabs navigator with a custom tab bar (`tabBarPosition` bottom/left at the
  768px breakpoint), so switching sections never stacks hidden screens.
- **Offline detail screens** seed from cached list data (`initialData`), so quick log works offline.
- **Unit tests** use jest-expo + React Native Testing Library 14 (async `render`/`fireEvent`); Watchman is
  disabled for Jest.
- **E2E** runs Playwright against the real API (NODE_ENV=test, fresh PGlite) serving the exported web build.

## Alternatives considered

- NativeWind 5 RC + Tailwind 4: release candidate, not "latest stable".
- AsyncStorage for the query cache: slower and async; MMKV is what the spec names.

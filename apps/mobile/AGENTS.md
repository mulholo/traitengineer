# @te/mobile

One Expo Router app for iOS (primary), Android and web. The web build (`expo export --platform web`, single-page
output) is served by `@te/api` from the same origin, so web uses the session cookie and needs no CORS.

- **Imports:** `@te/contracts` and `@te/client` only from the workspace (dependency-cruiser enforces this).
- **Routes (`app/`):** `sign-in`, `consent` (OAuth for MCP clients), `(app)/` (Tabs: `index` Today, `targets/…`
  Stack, `reminders`, `settings`, hidden `entries/[id]`), `log/[toolId]` (modal; `log/recent` = last-used tool,
  used by the "Log evidence" home-screen quick action).
- **Layout:** `src/ui/AppShell.tsx` — custom tab bar: bottom bar below 768px, left sidebar at ≥768px.
- **Data:** TanStack Query via the generated client (`src/api/client.ts`). Cache and paused mutations persist to
  MMKV (native) / localStorage (web) (`src/query/client.ts`). Logging an entry uses the `CREATE_ENTRY` mutation
  defaults (optimistic insert, idempotent `clientId`), so it works offline and survives restarts. Never pass
  callbacks to `useLogEntry()` — they replace the defaults. `SyncBanner` shows "n entries waiting to sync".
- **Auth:** native stores the Better Auth session token in `expo-secure-store` and sends it as a bearer token;
  web uses the httpOnly cookie. Passkeys are web-only in v1 (ADR 0029).
- **Platform code:** `*.native.ts` / `*.ts` (web) pairs in `src/platform/` and `src/auth/passkey*`.
- **Tools:** `src/tools/<type>/{QuickLogForm,EntryCard}.tsx`, registered in `src/tools/index.ts` as a complete
  `Record<ToolType, ToolUi>` (typecheck fails if a registry type has no UI).
- **Design:** NativeWind; tokens (colours as CSS variables with light/dark, spacing `tap`=44px, radius, type
  scale) in `tailwind.config.js` + `global.css`. Every control ≥44pt with an accessibility label (an e2e test
  measures it). Every screen must render on web.
- **Commands:** `pnpm --filter @te/mobile web` (dev; set `EXPO_PUBLIC_API_URL=http://localhost:3000`),
  `pnpm --filter @te/mobile build` (web export to `dist/web`), `pnpm --filter @te/mobile test` (jest-expo),
  `pnpm --filter @te/mobile e2e` (Playwright; builds must exist; starts the API itself and writes screenshots
  to `docs/screenshots/`), `pnpm --filter @te/mobile ios` (dev build in the simulator; needs Xcode).

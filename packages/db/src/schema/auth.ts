import { bigint, boolean, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tstz } from "./columns.ts";
import { users } from "./users.ts";

/*
 * Better Auth tables. Property names must match Better Auth's field names (the drizzle adapter maps
 * by property). `verifications` and `rate_limits` are Better Auth bookkeeping keyed by identifier/IP, not user
 * data, so they carry no user_id (ADR 0024).
 */

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: userId(),
    token: text("token").notNull().unique(),
    expiresAt: tstz("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Credential account holds the password hash (scrypt via Better Auth). Never select it outside auth code. */
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: userId(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: tstz("access_token_expires_at"),
    refreshTokenExpiresAt: tstz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: tstz("expires_at").notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const passkeys = pgTable(
  "passkeys",
  {
    id: id(),
    userId: userId(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
    ...timestamps,
  },
  (t) => [index("passkeys_user_idx").on(t.userId), index("passkeys_credential_id_idx").on(t.credentialID)],
);

export const rateLimits = pgTable("rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/**
 * Failed sign-in tracking per hashed email and per IP (durable across restarts). See core `LoginThrottle`.
 * Keys are `email:<sha256>` / `ip:<address>`; no plaintext email is stored.
 */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: tstz("window_started_at").notNull(),
  lockedUntil: tstz("locked_until"),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

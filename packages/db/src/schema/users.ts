import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns.ts";

/**
 * Owned by Better Auth (model `user`, mapped to this table), extended with `timezone`. Better Auth field
 * `name` maps to `display_name`. The password hash lives in Better Auth's `accounts` table, never here.
 *
 * `display_name` is not a product feature (ADR 0035): no API, MCP tool or screen reads or writes it. It stays
 * only because Better Auth's core user model requires a non-null `name`.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    displayName: text("display_name").notNull().default(""),
    image: text("image"),
    timezone: text("timezone").notNull().default("Europe/London"),
    ...timestamps,
  },
  (t) => [check("users_email_lower_case", sql`${t.email} = lower(${t.email})`)],
);

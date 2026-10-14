import { timestamp, uuid } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/** UUIDv7 primary key generated in the app (time-ordered, index friendly). */
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const timestamps = {
  createdAt: tstz("created_at").notNull().defaultNow(),
  updatedAt: tstz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

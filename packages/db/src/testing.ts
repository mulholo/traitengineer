import { v7 as uuidv7 } from "uuid";
import type { Database } from "./client.ts";
import { users } from "./schema/index.ts";

/** Insert a bare user row (bypassing Better Auth) for tests and seeding. */
export async function insertUser(
  db: Database,
  data: { email?: string; displayName?: string; timezone?: string } = {},
): Promise<{ id: string; email: string }> {
  const email = (data.email ?? `user-${uuidv7()}@example.test`).toLowerCase();
  const [row] = await db
    .insert(users)
    .values({
      email,
      displayName: data.displayName ?? "Test user",
      timezone: data.timezone ?? "Europe/London",
    })
    .returning({ id: users.id, email: users.email });
  if (!row) throw new Error("failed to insert user");
  return row;
}

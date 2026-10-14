import { DEFAULT_TIME_ZONE } from "@te/contracts";
import { MIN_PASSWORD_LENGTH, type Auth } from "./better-auth.ts";

export class OwnerError extends Error {}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new OwnerError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

/**
 * Create the single owner account (user + credential account with a scrypt hash). Refuses if any user
 * exists, so it can never be used to add a second account.
 */
export async function createOwner(
  auth: Auth,
  input: { email: string; password: string; displayName?: string },
) {
  checkPassword(input.password);
  const ctx = await auth.$context;
  const existing = await ctx.adapter.count({ model: "user" });
  if (existing > 0)
    throw new OwnerError(
      "A user already exists. Trait Engineer has exactly one owner; use user:set-password to reset.",
    );
  const user = await ctx.internalAdapter.createUser(
    {
      email: input.email.trim().toLowerCase(),
      name: input.displayName ?? "Owner",
      emailVerified: true,
      timezone: DEFAULT_TIME_ZONE,
    },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(input.password),
  });
  return { userId: user.id };
}

/** Reset the owner's password on the server and revoke every session. */
export async function setOwnerPassword(auth: Auth, input: { email: string; password: string }) {
  checkPassword(input.password);
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(input.email.trim().toLowerCase(), {
    includeAccounts: true,
  });
  if (!found) throw new OwnerError("No user with that email.");
  const hash = await ctx.password.hash(input.password);
  if (found.accounts.some((a) => a.providerId === "credential")) {
    await ctx.internalAdapter.updatePassword(found.user.id, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: found.user.id,
      providerId: "credential",
      accountId: found.user.id,
      password: hash,
    });
  }
  await ctx.internalAdapter.deleteUserSessions(found.user.id);
  return { userId: found.user.id };
}

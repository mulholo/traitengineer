import { expo } from "@better-auth/expo";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import type { Database } from "@te/db";
import {
  accounts,
  jwks,
  oauthAccessTokens,
  oauthClientAssertions,
  oauthClientResources,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  oauthResources,
  passkeys,
  rateLimits,
  sessions,
  users,
  verifications,
} from "@te/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";
import type { Env } from "../env.ts";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const MIN_PASSWORD_LENGTH = 12;
/** OAuth scopes offered to MCP clients. `read`/`write` map to TE scopes; the rest are standard OIDC. */
export const MCP_SCOPES = ["openid", "profile", "offline_access", "read", "write"] as const;

/** Canonical MCP resource identifier (token audience). */
export function mcpResource(env: Pick<Env, "PUBLIC_URL">): string {
  return `${env.PUBLIC_URL.replace(/\/$/, "")}/mcp`;
}

export function createAuth(db: Database, env: Env) {
  const publicUrl = new URL(env.PUBLIC_URL);
  const isTest = env.NODE_ENV === "test";
  return betterAuth({
    appName: "Trait Engineer",
    baseURL: env.PUBLIC_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        passkey: passkeys,
        rateLimit: rateLimits,
        jwks,
        oauthClient: oauthClients,
        oauthResource: oauthResources,
        oauthClientResource: oauthClientResources,
        oauthRefreshToken: oauthRefreshTokens,
        oauthAccessToken: oauthAccessTokens,
        oauthConsent: oauthConsents,
        oauthClientAssertion: oauthClientAssertions,
      },
    }),
    user: {
      fields: { name: "displayName" },
      additionalFields: {
        timezone: { type: "string", required: false, defaultValue: "Europe/London", input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      // Single owner: accounts are only created by `pnpm user:create-owner` (ADR 0025). Tests may sign up.
      disableSignUp: !isTest,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 256,
      revokeSessionsOnPasswordReset: true,
    },
    session: { expiresIn: SESSION_TTL_SECONDS, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
    },
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: publicUrl.protocol === "https:",
      ipAddress: { ipAddressHeaders: [env.CLIENT_IP_HEADER] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: publicUrl.protocol === "https:" },
    },
    trustedOrigins: [
      env.PUBLIC_URL,
      "traitengineer://",
      ...(env.NODE_ENV === "development"
        ? ["http://localhost:8081", "http://localhost:19006", "exp://"]
        : []),
    ],
    plugins: [
      passkey({ rpID: publicUrl.hostname, rpName: "Trait Engineer", origin: env.PUBLIC_URL }),
      bearer(),
      expo(),
      jwt(),
      // OAuth 2.1 authorisation server for MCP clients (Claude custom connectors). ADR 0027.
      mcp({
        loginPage: "/sign-in",
        consentPage: "/consent",
        resource: mcpResource(env),
        scopes: [...MCP_SCOPES],
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
      }),
    ],
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

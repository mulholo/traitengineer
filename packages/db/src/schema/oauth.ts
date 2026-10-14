import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sessions } from "./auth.ts";
import { id, tstz } from "./columns.ts";
import { users } from "./users.ts";

/*
 * Tables for Better Auth's `jwt()` + `mcp()` (OAuth 2.1 provider) plugins, used by MCP clients such as Claude.
 * Property names must match Better Auth field names. Client registrations made through dynamic client
 * registration have no owner, so `oauth_clients.user_id` is nullable; resources are server configuration
 * (ADR 0027).
 */

const optionalUser = () => uuid("user_id").references(() => users.id, { onDelete: "cascade" });
const optionalSession = () => uuid("session_id").references(() => sessions.id, { onDelete: "set null" });
const created = () => tstz("created_at").defaultNow();
const updated = () => tstz("updated_at").defaultNow();

export const jwks = pgTable("jwks", {
  id: id(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  alg: text("alg"),
  crv: text("crv"),
  createdAt: tstz("created_at").notNull().defaultNow(),
  expiresAt: tstz("expires_at"),
});

export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: id(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled"),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes").array(),
    userId: optionalUser(),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required"),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens"),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("oauth_clients_user_idx").on(t.userId)],
);

export const oauthResources = pgTable("oauth_resources", {
  id: id(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required"),
  disabled: boolean("disabled"),
  policyVersion: integer("policy_version"),
  metadata: jsonb("metadata"),
  createdAt: created(),
  updatedAt: updated(),
});

export const oauthClientResources = pgTable(
  "oauth_client_resources",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResources.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: created(),
  },
  (t) => [
    index("oauth_client_resources_client_idx").on(t.clientId),
    index("oauth_client_resources_resource_idx").on(t.resourceId),
  ],
);

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: id(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: optionalSession(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: tstz("expires_at"),
    revoked: tstz("revoked"),
    rotatedAt: tstz("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: tstz("rotation_replay_expires_at"),
    authTime: tstz("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
    createdAt: created(),
  },
  (t) => [
    index("oauth_refresh_tokens_client_idx").on(t.clientId),
    index("oauth_refresh_tokens_user_idx").on(t.userId),
    index("oauth_refresh_tokens_session_idx").on(t.sessionId),
    index("oauth_refresh_tokens_code_idx").on(t.authorizationCodeId),
  ],
);

export const oauthAccessTokens = pgTable(
  "oauth_access_tokens",
  {
    id: id(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    sessionId: optionalSession(),
    userId: optionalUser(),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: uuid("refresh_id").references(() => oauthRefreshTokens.id, { onDelete: "cascade" }),
    expiresAt: tstz("expires_at"),
    revoked: tstz("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
    createdAt: created(),
  },
  (t) => [
    index("oauth_access_tokens_client_idx").on(t.clientId),
    index("oauth_access_tokens_user_idx").on(t.userId),
    index("oauth_access_tokens_session_idx").on(t.sessionId),
    index("oauth_access_tokens_refresh_idx").on(t.refreshId),
    index("oauth_access_tokens_code_idx").on(t.authorizationCodeId),
  ],
);

export const oauthConsents = pgTable(
  "oauth_consents",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: "cascade" }),
    userId: optionalUser(),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("oauth_consents_client_idx").on(t.clientId), index("oauth_consents_user_idx").on(t.userId)],
);

export const oauthClientAssertions = pgTable("oauth_client_assertions", {
  id: id(),
  expiresAt: tstz("expires_at").notNull(),
});

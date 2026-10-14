import { createHash, randomBytes } from "node:crypto";
import {
  createPersonalAccessTokenSchema,
  type CreatedPersonalAccessToken,
  type CreatePersonalAccessToken,
  type PersonalAccessToken,
  type Scope,
} from "@te/contracts";
import { NotFoundError } from "../errors.ts";
import type { TokenRecord } from "../repositories.ts";
import { parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export const PAT_PREFIX = "te_pat_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPersonalAccessToken(token: string): boolean {
  return token.startsWith(PAT_PREFIX);
}

function toPublic({ userId: _userId, ...t }: TokenRecord): PersonalAccessToken {
  return t;
}

export type TokenService = ReturnType<typeof createTokenService>;

export function createTokenService({ repos, now }: ServiceDeps) {
  return {
    /** Returns the plaintext once; only the SHA-256 hash is stored. */
    async create(userId: string, input: CreatePersonalAccessToken): Promise<CreatedPersonalAccessToken> {
      const data = parseOrThrow(createPersonalAccessTokenSchema, input, "token");
      const token = PAT_PREFIX + randomBytes(32).toString("base64url");
      const scopes: Scope[] = data.scope === "write" ? ["read", "write"] : ["read"];
      const record = await repos.tokens.create(userId, {
        name: data.name,
        tokenHash: hashToken(token),
        scopes,
      });
      return { ...toPublic(record), token };
    },
    async list(userId: string): Promise<PersonalAccessToken[]> {
      return (await repos.tokens.list(userId)).map(toPublic);
    },
    async revoke(userId: string, id: string): Promise<void> {
      if (!(await repos.tokens.revoke(userId, id, now().toISOString()))) throw new NotFoundError("Token", id);
    },
    /** Resolve a presented token to its owner and scopes, or null. Records last use. */
    async verify(token: string): Promise<{ userId: string; scopes: Scope[]; tokenId: string } | null> {
      if (!isPersonalAccessToken(token)) return null;
      const record = await repos.tokens.findActiveByHash(hashToken(token));
      if (!record) return null;
      await repos.tokens.touch(record.id, now().toISOString());
      return { userId: record.userId, scopes: record.scopes, tokenId: record.id };
    },
  };
}

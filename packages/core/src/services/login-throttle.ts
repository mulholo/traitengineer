import { createHash } from "node:crypto";
import type { LoginAttemptRecord } from "../repositories.ts";
import type { ServiceDeps } from "./context.ts";

export interface LoginThrottleOptions {
  /** Failures allowed inside the window before locking (default 5). */
  maxFailures?: number;
  /** Window and first lock duration in ms (default 15 minutes). Each further failure doubles the lock. */
  windowMs?: number;
}

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;

/** Keys for one sign-in attempt. The email is hashed so it is never stored in plaintext. */
export function loginKeys(email: string | undefined, ip: string | undefined): string[] {
  const keys: string[] = [];
  if (email) keys.push(`email:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`);
  if (ip) keys.push(`ip:${ip}`);
  return keys;
}

/**
 * Durable brute-force protection for sign-in, per email and per IP: `maxFailures` failures within the window
 * locks the key for one window; every further failure doubles the lock (exponential backoff). A quiet window
 * after the lock expires resets the count.
 */
export function createLoginThrottle({ repos, now }: ServiceDeps, opts: LoginThrottleOptions = {}) {
  const maxFailures = opts.maxFailures ?? 5;
  const windowMs = opts.windowMs ?? 15 * 60_000;

  function isStale(r: LoginAttemptRecord, t: number): boolean {
    const quietSince = r.lockedUntil ? Date.parse(r.lockedUntil) : Date.parse(r.windowStartedAt);
    return t - quietSince > windowMs;
  }

  return {
    /** Seconds until the caller may retry, or 0 when allowed. */
    async retryAfter(keys: string[]): Promise<number> {
      const t = now().getTime();
      let wait = 0;
      for (const r of await repos.loginAttempts.get(keys)) {
        if (r.lockedUntil && Date.parse(r.lockedUntil) > t)
          wait = Math.max(wait, Math.ceil((Date.parse(r.lockedUntil) - t) / 1000));
      }
      return wait;
    },

    async recordFailure(keys: string[]): Promise<void> {
      const t = now().getTime();
      const existing = new Map((await repos.loginAttempts.get(keys)).map((r) => [r.key, r]));
      for (const key of keys) {
        const prev = existing.get(key);
        const fresh = !prev || isStale(prev, t);
        const failures = fresh ? 1 : prev.failures + 1;
        const lockMs = failures >= maxFailures ? windowMs * 2 ** (failures - maxFailures) : 0;
        await repos.loginAttempts.put({
          key,
          failures,
          windowStartedAt: fresh ? new Date(t).toISOString() : prev.windowStartedAt,
          lockedUntil: lockMs > 0 ? new Date(t + lockMs).toISOString() : null,
        });
      }
    },

    async recordSuccess(keys: string[]): Promise<void> {
      await repos.loginAttempts.clear(keys);
    },
  };
}

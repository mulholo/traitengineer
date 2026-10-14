import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    ROLE: z.enum(["web", "worker", "all"]).default("all"),
    PORT: z.coerce.number().int().default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    PUBLIC_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: optionalString,
    DATABASE_URL_DIRECT: optionalString,
    PGLITE_DIR: optionalString,
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    OWNER_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
    /** Header carrying the real client IP behind the proxy (Fly sets Fly-Client-IP). */
    CLIENT_IP_HEADER: z.string().default("fly-client-ip"),
    SENTRY_DSN: optionalString,
    EXPO_ACCESS_TOKEN: optionalString,
    WEB_DIST_DIR: optionalString,
    WRITE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (!env.DATABASE_URL)
        ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "Required in production" });
      if (env.BETTER_AUTH_SECRET.startsWith("replace-me")) {
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_SECRET"],
          message: "Set a real secret in production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parse env or exit: misconfiguration should fail at boot, not at first request. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }
  return result.data;
}

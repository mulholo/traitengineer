import { z } from "zod";

export const idSchema = z
  .uuid()
  .meta({ description: "UUIDv7 identifier", example: "01927a4e-6f0b-7160-bcce-23cb1342b381" });

/** ISO 8601 timestamp. Responses are always UTC (`Z`); inputs may carry an offset. */
export const timestampSchema = z.iso.datetime({ offset: true }).meta({ example: "2026-10-14T08:30:00.000Z" });

export function isValidTimeZone(tz: string): boolean {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz }).resolvedOptions().timeZone.length > 0;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: "Must be an IANA time zone, e.g. Europe/London" })
  .meta({ example: "Europe/London" });

export const DEFAULT_TIME_ZONE = "Europe/London";

export const sourceSchema = z.enum(["mobile", "web", "mcp", "api"]);
export type Source = z.infer<typeof sourceSchema>;

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 200;

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
  cursor: z.string().min(1).optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export type Page<T> = { items: T[]; nextCursor: string | null };

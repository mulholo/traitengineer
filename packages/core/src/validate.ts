import type { z } from "zod";
import { ValidationError } from "./errors.ts";

/** Parse with a contracts schema, converting Zod issues into a ValidationError. */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  input: unknown,
  what = "input",
  prefix = "",
): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => ({
    path: [prefix, ...i.path.map(String)].filter(Boolean).join("."),
    message: i.message,
  }));
  throw new ValidationError(`Invalid ${what}`, issues);
}

export type Compact<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

/** Drop keys whose value is `undefined` (Zod partial output → exactOptionalPropertyTypes-friendly patch). */
export function compact<T extends object>(obj: T): Compact<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Compact<T>;
}

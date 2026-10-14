import { ValidationError } from "./errors.ts";

/** Opaque keyset cursors: base64url-encoded JSON of the last row's sort key. */
export function encodeCursor(key: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

export function decodeCursor<K extends Record<string, string | number>>(
  cursor: string | undefined,
  isKey: (v: unknown) => v is K,
): K | undefined {
  if (cursor === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (isKey(value)) return value;
  } catch {
    // fall through
  }
  throw new ValidationError("Invalid cursor", [{ path: "cursor", message: "Malformed or expired cursor" }]);
}

export interface SortKey extends Record<string, string | number> {
  sortOrder: number;
  id: string;
}
export interface TimeKey extends Record<string, string | number> {
  occurredAt: string;
  id: string;
}

export const isSortKey = (v: unknown): v is SortKey =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as SortKey).sortOrder === "number" &&
  typeof (v as SortKey).id === "string";

export const isTimeKey = (v: unknown): v is TimeKey =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as TimeKey).occurredAt === "string" &&
  typeof (v as TimeKey).id === "string";

/** Given `limit + 1` rows, return the page and the cursor for the next one. */
export function paginate<T, K extends Record<string, string | number>>(
  rows: T[],
  limit: number,
  keyOf: (row: T) => K,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: last === undefined ? null : encodeCursor(keyOf(last)) };
}

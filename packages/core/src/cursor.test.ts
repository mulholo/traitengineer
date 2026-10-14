import { describe, expect, test } from "vitest";
import { decodeCursor, encodeCursor, isSortKey, isTimeKey, paginate } from "./cursor.ts";

describe("cursors", () => {
  test("round-trip a key", () => {
    const key = { sortOrder: 3, id: "abc" };
    expect(decodeCursor(encodeCursor(key), isSortKey)).toEqual(key);
    expect(decodeCursor(undefined, isSortKey)).toBeUndefined();
  });

  test("reject malformed or wrong-shaped cursors as validation errors", () => {
    expect(() => decodeCursor("%%%", isSortKey)).toThrow(
      expect.objectContaining({ code: "validation_failed" }),
    );
    const timeCursor = encodeCursor({ occurredAt: "2026-01-01T00:00:00.000Z", id: "x" });
    expect(() => decodeCursor(timeCursor, isSortKey)).toThrow(
      expect.objectContaining({ code: "validation_failed" }),
    );
    expect(decodeCursor(timeCursor, isTimeKey)).toEqual({ occurredAt: "2026-01-01T00:00:00.000Z", id: "x" });
  });

  test("paginate takes limit+1 rows and emits a cursor for the last returned row", () => {
    const rows = [1, 2, 3].map((n) => ({ sortOrder: n, id: `id${n}` }));
    const page = paginate(rows, 2, (r) => r);
    expect(page.items).toEqual(rows.slice(0, 2));
    expect(decodeCursor(page.nextCursor ?? undefined, isSortKey)).toEqual(rows[1]);
    expect(paginate(rows, 3, (r) => r).nextCursor).toBeNull();
  });
});

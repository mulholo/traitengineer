/**
 * Wall-clock ↔ instant conversion in an IANA zone, using only Intl. A "floating" Date is one whose UTC fields
 * hold a local wall time (this is how `rrule` computes recurrences without a zone).
 */

const HOUR = 3_600_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall time at `instant` in `timeZone`, as a floating Date (second precision). */
export function toFloating(instant: Date, timeZone: string): Date {
  const parts: Record<string, number> = {};
  for (const p of fmt(timeZone).formatToParts(instant))
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  return new Date(
    Date.UTC(
      parts["year"] ?? 1970,
      (parts["month"] ?? 1) - 1,
      parts["day"] ?? 1,
      parts["hour"] ?? 0,
      parts["minute"] ?? 0,
      parts["second"] ?? 0,
    ),
  );
}

/** Offset (local − UTC) in ms at `instant`. */
function offsetAt(instant: number, timeZone: string): number {
  const truncated = instant - (instant % 1000);
  return toFloating(new Date(truncated), timeZone).getTime() - truncated;
}

/**
 * The instant at which the wall clock in `timeZone` shows `floating`.
 * - Ambiguous (clocks went back): the earlier instant.
 * - Non-existent (clocks went forward): shifted forward by the gap (e.g. 01:30 → 02:30 BST).
 */
export function fromFloating(floating: Date, timeZone: string): Date {
  const wall = floating.getTime();
  const before = offsetAt(wall - 24 * HOUR, timeZone);
  const after = offsetAt(wall + 24 * HOUR, timeZone);
  const valid = [...new Set([before, after])]
    .map((o) => wall - o)
    .filter((c) => toFloating(new Date(c), timeZone).getTime() === wall)
    .sort((a, b) => a - b);
  return new Date(valid[0] ?? wall - before);
}

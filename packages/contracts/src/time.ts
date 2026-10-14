/**
 * Calendar helpers that work in an IANA time zone using only Intl. A "local date" is a `YYYY-MM-DD` string
 * for the calendar day an instant falls on in that zone.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

export function localDate(instant: Date | string, timeZone: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD.
  return formatter(timeZone).format(d);
}

function toUtcMidnight(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

const DAY_MS = 86_400_000;

/** Whole calendar days from `a` to `b` (both local dates). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMidnight(b) - toUtcMidnight(a)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** ISO 8601 week label (`2026-W42`) for a local date. */
export function isoWeek(date: string): string {
  const t = new Date(toUtcMidnight(date));
  const dayNum = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // Thursday of this week
  const isoYear = t.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** The last `count` ISO week labels ending with the week containing `today`, oldest first. */
export function lastIsoWeeks(today: string, count: number): string[] {
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) weeks.push(isoWeek(addDays(today, -7 * i)));
  return weeks;
}

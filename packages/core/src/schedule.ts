// rrule ships UMD/CJS without an `exports` map, so Node ESM only exposes it as a default export.
// oxlint-disable-next-line import/default
import rrulePkg from "rrule";
import type { ReminderSchedule } from "@te/contracts";
import { ValidationError } from "./errors.ts";
import { fromFloating, toFloating } from "./zoned.ts";

// oxlint-disable-next-line import/no-named-as-default-member -- see the import comment above
const { RRule } = rrulePkg;

function hm(time: string): [number, number] {
  const [h, m] = time.split(":").map(Number);
  return [h ?? 0, m ?? 0];
}
const pad = (n: number) => String(n).padStart(2, "0");

/** Compile a UI preset into an RFC 5545 RRULE value (no DTSTART; times are wall-clock in the reminder's zone). */
export function scheduleToRrule(s: ReminderSchedule): string {
  switch (s.type) {
    case "daily": {
      const [h, m] = hm(s.time);
      return `FREQ=DAILY;BYHOUR=${h};BYMINUTE=${m};BYSECOND=0`;
    }
    case "weekdays": {
      const [h, m] = hm(s.time);
      return `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=${h};BYMINUTE=${m};BYSECOND=0`;
    }
    case "every_n_hours": {
      const [sh, sm] = hm(s.start);
      const [eh, em] = hm(s.end);
      const hours: number[] = [];
      for (let h = sh; h * 60 + sm <= eh * 60 + em; h += s.everyHours) hours.push(h);
      return `FREQ=DAILY;BYHOUR=${hours.join(",")};BYMINUTE=${sm};BYSECOND=0`;
    }
  }
}

/** Inverse of scheduleToRrule for the rules it produces. */
export function rruleToSchedule(rule: string): ReminderSchedule {
  const parts = Object.fromEntries(rule.split(";").map((kv) => kv.split("=") as [string, string]));
  const hours = (parts["BYHOUR"] ?? "").split(",").filter(Boolean).map(Number);
  const minute = Number(parts["BYMINUTE"] ?? 0);
  const first = hours[0];
  if (first === undefined) throw new ValidationError(`Unsupported rrule: ${rule}`);
  const time = `${pad(first)}:${pad(minute)}`;
  if (parts["FREQ"] === "WEEKLY" && parts["BYDAY"] === "MO,TU,WE,TH,FR") return { type: "weekdays", time };
  if (parts["FREQ"] === "DAILY" && hours.length === 1) return { type: "daily", time };
  const second = hours[1];
  if (parts["FREQ"] === "DAILY" && second !== undefined) {
    const last = hours.at(-1) ?? first;
    return {
      type: "every_n_hours",
      everyHours: second - first,
      start: time,
      end: `${pad(last)}:${pad(minute)}`,
    };
  }
  throw new ValidationError(`Unsupported rrule: ${rule}`);
}

/**
 * The first occurrence strictly after `after`, as a real instant, evaluating the rule's wall-clock times in
 * `timeZone`. DST: skipped wall times shift forward by the gap; repeated wall times fire once (the first).
 */
export function nextOccurrence(rule: string, timeZone: string, after: Date): Date | null {
  let floatingAfter = toFloating(after, timeZone);
  const dtstart = new Date(floatingAfter.getTime() - 2 * 86_400_000);
  dtstart.setUTCHours(0, 0, 0, 0);
  const rr = new RRule({ ...RRule.parseString(rule), dtstart });
  // A handful of iterations covers DST edge cases where a wall time maps to an instant <= after.
  for (let i = 0; i < 8; i++) {
    const occ = rr.after(floatingAfter, false);
    if (!occ) return null;
    const instant = fromFloating(occ, timeZone);
    if (instant.getTime() > after.getTime()) return instant;
    floatingAfter = occ;
  }
  return null;
}

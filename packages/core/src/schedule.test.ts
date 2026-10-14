import { describe, expect, test } from "vitest";
import { nextOccurrence, rruleToSchedule, scheduleToRrule } from "./schedule.ts";
import { fromFloating, toFloating } from "./zoned.ts";

const LON = "Europe/London";
const floating = (iso: string) => new Date(`${iso}Z`);

describe("zoned conversion", () => {
  test("round-trips ordinary times", () => {
    const i = new Date("2026-07-01T07:30:00Z");
    expect(toFloating(i, LON).toISOString()).toBe("2026-07-01T08:30:00.000Z");
    expect(fromFloating(floating("2026-07-01T08:30:00"), LON).toISOString()).toBe(i.toISOString());
    expect(fromFloating(floating("2026-01-15T08:30:00"), LON).toISOString()).toBe("2026-01-15T08:30:00.000Z");
  });

  test("non-existent wall time (spring forward) shifts forward by the gap", () => {
    // 29 Mar 2026: 01:00 GMT → 02:00 BST, so 01:30 does not exist; it becomes 02:30 BST = 01:30Z.
    expect(fromFloating(floating("2026-03-29T01:30:00"), LON).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  test("ambiguous wall time (fall back) resolves to the first occurrence", () => {
    // 25 Oct 2026: 01:30 happens at 00:30Z (BST) and again at 01:30Z (GMT).
    expect(fromFloating(floating("2026-10-25T01:30:00"), LON).toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  test("works for zones far from UTC", () => {
    expect(fromFloating(floating("2026-10-14T09:00:00"), "Asia/Kolkata").toISOString()).toBe(
      "2026-10-14T03:30:00.000Z",
    );
    expect(fromFloating(floating("2026-10-14T09:00:00"), "America/Los_Angeles").toISOString()).toBe(
      "2026-10-14T16:00:00.000Z",
    );
  });
});

describe("presets ⇄ rrule", () => {
  test.each([
    [{ type: "daily", time: "08:30" }, "FREQ=DAILY;BYHOUR=8;BYMINUTE=30;BYSECOND=0"],
    [{ type: "weekdays", time: "18:05" }, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=18;BYMINUTE=5;BYSECOND=0"],
    [
      { type: "every_n_hours", everyHours: 3, start: "09:00", end: "18:00" },
      "FREQ=DAILY;BYHOUR=9,12,15,18;BYMINUTE=0;BYSECOND=0",
    ],
  ] as const)("%o", (schedule, rule) => {
    expect(scheduleToRrule(schedule)).toBe(rule);
    expect(rruleToSchedule(rule)).toEqual(schedule);
  });

  test("every_n_hours end is inclusive only when reachable", () => {
    expect(scheduleToRrule({ type: "every_n_hours", everyHours: 4, start: "09:30", end: "18:00" })).toBe(
      "FREQ=DAILY;BYHOUR=9,13,17;BYMINUTE=30;BYSECOND=0",
    );
  });
});

describe("nextOccurrence", () => {
  const daily0830 = "FREQ=DAILY;BYHOUR=8;BYMINUTE=30;BYSECOND=0";

  test("daily in London summer and winter", () => {
    expect(nextOccurrence(daily0830, LON, new Date("2026-07-01T06:00:00Z"))?.toISOString()).toBe(
      "2026-07-01T07:30:00.000Z",
    );
    expect(nextOccurrence(daily0830, LON, new Date("2026-07-01T07:30:00Z"))?.toISOString()).toBe(
      "2026-07-02T07:30:00.000Z",
    );
    expect(nextOccurrence(daily0830, LON, new Date("2026-12-01T09:00:00Z"))?.toISOString()).toBe(
      "2026-12-02T08:30:00.000Z",
    );
  });

  test("stays at 08:30 local across the last Sunday of March", () => {
    const sat = nextOccurrence(daily0830, LON, new Date("2026-03-28T00:00:00Z"));
    const sun = nextOccurrence(daily0830, LON, sat ?? new Date());
    const mon = nextOccurrence(daily0830, LON, sun ?? new Date());
    expect([sat, sun, mon].map((d) => d?.toISOString())).toEqual([
      "2026-03-28T08:30:00.000Z", // GMT
      "2026-03-29T07:30:00.000Z", // BST from today
      "2026-03-30T07:30:00.000Z",
    ]);
  });

  test("stays at 08:30 local across the last Sunday of October", () => {
    const sat = nextOccurrence(daily0830, LON, new Date("2026-10-24T00:00:00Z"));
    const sun = nextOccurrence(daily0830, LON, sat ?? new Date());
    expect([sat, sun].map((d) => d?.toISOString())).toEqual([
      "2026-10-24T07:30:00.000Z",
      "2026-10-25T08:30:00.000Z",
    ]);
  });

  test("a reminder in the skipped hour fires once, shifted forward", () => {
    const rule = "FREQ=DAILY;BYHOUR=1;BYMINUTE=30;BYSECOND=0";
    const first = nextOccurrence(rule, LON, new Date("2026-03-28T12:00:00Z"));
    expect(first?.toISOString()).toBe("2026-03-29T01:30:00.000Z"); // 02:30 BST
    expect(nextOccurrence(rule, LON, first ?? new Date())?.toISOString()).toBe("2026-03-30T00:30:00.000Z"); // 01:30 BST
  });

  test("a reminder in the repeated hour fires once, not twice", () => {
    const rule = "FREQ=DAILY;BYHOUR=1;BYMINUTE=30;BYSECOND=0";
    const first = nextOccurrence(rule, LON, new Date("2026-10-24T12:00:00Z"));
    expect(first?.toISOString()).toBe("2026-10-25T00:30:00.000Z"); // first 01:30 (BST)
    const second = nextOccurrence(rule, LON, first ?? new Date());
    expect(second?.toISOString()).toBe("2026-10-26T01:30:00.000Z"); // next day 01:30 GMT, not 01:30Z the same day
  });

  test("weekdays skips the weekend", () => {
    const rule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0";
    // Fri 16 Oct 2026 10:00 BST → Mon 19 Oct 09:00 BST.
    expect(nextOccurrence(rule, LON, new Date("2026-10-16T09:00:00Z"))?.toISOString()).toBe(
      "2026-10-19T08:00:00.000Z",
    );
  });

  test("every N hours walks through the window then to the next day", () => {
    const rule = "FREQ=DAILY;BYHOUR=9,12,15,18;BYMINUTE=0;BYSECOND=0";
    expect(nextOccurrence(rule, LON, new Date("2026-10-14T11:00:00Z"))?.toISOString()).toBe(
      "2026-10-14T14:00:00.000Z",
    );
    expect(nextOccurrence(rule, LON, new Date("2026-10-14T17:00:00Z"))?.toISOString()).toBe(
      "2026-10-15T08:00:00.000Z",
    );
  });
});

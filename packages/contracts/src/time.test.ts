import { describe, expect, test } from "vitest";
import { addDays, daysBetween, isoWeek, lastIsoWeeks, localDate } from "./time.ts";
import { isValidTimeZone } from "./common.ts";

describe("localDate", () => {
  test("uses the zone's calendar day, not UTC", () => {
    // 23:30 UTC on 14 Oct is 00:30 on 15 Oct in London (BST, UTC+1).
    expect(localDate("2026-10-14T23:30:00Z", "Europe/London")).toBe("2026-10-15");
    expect(localDate("2026-10-14T23:30:00Z", "UTC")).toBe("2026-10-14");
    expect(localDate("2026-10-14T03:00:00Z", "America/Los_Angeles")).toBe("2026-10-13");
  });

  test("handles both sides of the October DST change in London", () => {
    // Clocks go back at 02:00 BST on 25 Oct 2026 (01:00 UTC).
    expect(localDate("2026-10-24T23:30:00Z", "Europe/London")).toBe("2026-10-25"); // 00:30 BST
    expect(localDate("2026-10-25T23:30:00Z", "Europe/London")).toBe("2026-10-25"); // 23:30 GMT
  });

  test("handles both sides of the March DST change in London", () => {
    // Clocks go forward at 01:00 GMT on 29 Mar 2026.
    expect(localDate("2026-03-28T23:30:00Z", "Europe/London")).toBe("2026-03-28"); // 23:30 GMT
    expect(localDate("2026-03-29T23:30:00Z", "Europe/London")).toBe("2026-03-30"); // 00:30 BST
  });
});

describe("calendar arithmetic", () => {
  test("daysBetween and addDays are exact across DST", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("isoWeek follows ISO 8601 including year boundaries", () => {
    expect(isoWeek("2026-10-14")).toBe("2026-W42");
    expect(isoWeek("2026-01-01")).toBe("2026-W01"); // Thursday
    expect(isoWeek("2027-01-01")).toBe("2026-W53"); // Friday; 2026 has 53 weeks
    expect(isoWeek("2024-12-30")).toBe("2025-W01"); // Monday
    expect(isoWeek("2021-01-03")).toBe("2020-W53"); // Sunday
  });

  test("lastIsoWeeks returns consecutive weeks oldest first", () => {
    expect(lastIsoWeeks("2026-10-14", 3)).toEqual(["2026-W40", "2026-W41", "2026-W42"]);
  });
});

test("isValidTimeZone accepts IANA zones and rejects junk", () => {
  expect(isValidTimeZone("Europe/London")).toBe(true);
  expect(isValidTimeZone("Not/AZone")).toBe(false);
});

import { expect, test } from "vitest";
import { role } from "./main.ts";

test("defaults to ROLE=all", () => {
  expect(role).toBe("all");
});

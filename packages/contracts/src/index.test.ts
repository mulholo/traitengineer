import { expect, test } from "vitest";
import { packageName } from "./index.ts";

test("exports its package name", () => {
  expect(packageName).toBe("@te/contracts");
});

import { z } from "zod";
import { expect, test } from "vitest";
import { ValidationError } from "./errors.ts";
import { compact, parseOrThrow } from "./validate.ts";

test("parseOrThrow returns parsed data with defaults", () => {
  const schema = z.object({ a: z.string(), b: z.number().default(1) });
  expect(parseOrThrow(schema, { a: "x" })).toEqual({ a: "x", b: 1 });
});

test("parseOrThrow maps issues to dotted paths with an optional prefix", () => {
  const schema = z.object({ nested: z.object({ n: z.number() }) });
  const run = () => parseOrThrow(schema, { nested: { n: "no" } }, "thing", "payload");
  expect(run).toThrow(ValidationError);
  expect(run).toThrow(
    expect.objectContaining({
      message: "Invalid thing",
      issues: [{ path: "payload.nested.n", message: expect.any(String) }],
    }),
  );
});

test("compact drops undefined but keeps null and falsy values", () => {
  expect(compact({ a: undefined, b: null, c: 0, d: "" })).toEqual({ b: null, c: 0, d: "" });
});

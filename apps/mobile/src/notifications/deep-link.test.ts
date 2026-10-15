import { pathFromDeepLink } from "./deep-link";

test("maps reminder deep links to router paths", () => {
  expect(pathFromDeepLink("traitengineer://log/01927a4e-6f0b-7160-bcce-23cb1342b381")).toBe(
    "/log/01927a4e-6f0b-7160-bcce-23cb1342b381",
  );
  expect(pathFromDeepLink("traitengineer://")).toBe("/");
  expect(pathFromDeepLink("https://evil.example/log/x")).toBeUndefined();
  expect(pathFromDeepLink(42)).toBeUndefined();
});

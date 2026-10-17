import { expect, test } from "vitest";
import { sanitizeTerminalInput } from "../src/cli/prompt.ts";

test("strips bracketed-paste markers, escape sequences and control characters", () => {
  expect(sanitizeTerminalInput("\u001b[200~correct horse battery\u001b[201~")).toBe("correct horse battery");
  expect(sanitizeTerminalInput("pässwörd with spaces & symbols!\r")).toBe("pässwörd with spaces & symbols!");
  expect(sanitizeTerminalInput("a\u001b[Db\u0007c")).toBe("abc");
  expect(sanitizeTerminalInput("plain-password-123")).toBe("plain-password-123");
});

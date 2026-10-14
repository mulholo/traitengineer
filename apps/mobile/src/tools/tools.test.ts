import { toolTypeNames } from "@te/contracts";
import { toPayload } from "./evidence_log/QuickLogForm";
import { toolUi } from "./index";

test("every tool type in the registry has a QuickLogForm and EntryCard", () => {
  for (const type of toolTypeNames) {
    expect(toolUi[type]?.QuickLogForm).toBeDefined();
    expect(toolUi[type]?.EntryCard).toBeDefined();
  }
});

test("evidence log form values become a valid payload", () => {
  expect(
    toPayload({
      summary: "  Sent it  ",
      expected: "Disaster",
      happened: "",
      supports: "Good enough",
      uncertain: "  ",
      details: "",
      difficulty: "3",
      tags: "work, , home ,work2",
    }),
  ).toEqual({
    summary: "Sent it",
    expected: "Disaster",
    supports: "Good enough",
    difficulty: 3,
    tags: ["work", "home", "work2"],
  });
  expect(toPayload({ summary: "x", difficulty: "", tags: "" })).toEqual({ summary: "x", tags: [] });
});

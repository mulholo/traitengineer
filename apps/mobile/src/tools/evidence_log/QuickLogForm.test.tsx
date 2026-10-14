import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Tool } from "../types";
import { QuickLogForm } from "./QuickLogForm";

const tool: Tool = {
  id: "01927a4e-6f0b-7160-bcce-23cb1342b381",
  changeTargetId: "01927a4e-6f0b-7160-bcce-23cb1342b382",
  type: "evidence_log",
  name: "Evidence log",
  config: { prompt: "What did you ship?", askDifficulty: true },
  sortOrder: 0,
  createdAt: "2026-10-14T00:00:00.000Z",
  updatedAt: "2026-10-14T00:00:00.000Z",
};

test("uses the tool's prompt as the first field and submits a validated payload", async () => {
  const onSubmit = jest.fn();
  await render(<QuickLogForm tool={tool} onSubmit={onSubmit} />);
  const summary = screen.getByLabelText("What did you ship?");
  expect(summary.props.autoFocus).toBe(true);

  await fireEvent.changeText(summary, "Sent the proposal");
  await fireEvent.changeText(screen.getByLabelText("What happened"), "Signed same day");
  await fireEvent.press(screen.getByLabelText("4"));
  await fireEvent.changeText(screen.getByLabelText("Tags"), "work, sales");
  await fireEvent.press(screen.getByText("Save"));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith({
    summary: "Sent the proposal",
    happened: "Signed same day",
    difficulty: 4,
    tags: ["work", "sales"],
  });
});

test("refuses to submit without a summary and explains why", async () => {
  const onSubmit = jest.fn();
  await render(<QuickLogForm tool={tool} onSubmit={onSubmit} />);
  await fireEvent.press(screen.getByText("Save"));
  expect(await screen.findByText("Say what you did (1–280 characters)")).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("hides difficulty when the tool config says not to ask", async () => {
  await render(<QuickLogForm tool={{ ...tool, config: { askDifficulty: false } }} onSubmit={jest.fn()} />);
  expect(screen.getByLabelText("What did you do?")).toBeTruthy();
  expect(screen.queryByLabelText("Difficulty (1 easy – 5 very hard)")).toBeNull();
});

test("prefills an existing payload when editing", async () => {
  await render(
    <QuickLogForm
      tool={tool}
      initialPayload={{ summary: "Old", tags: ["a", "b"], difficulty: 2 }}
      onSubmit={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("What did you ship?").props.value).toBe("Old");
  expect(screen.getByLabelText("Tags").props.value).toBe("a, b");
});

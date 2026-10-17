import { createInterface } from "node:readline";
import { Writable } from "node:stream";

/**
 * Strip terminal artefacts from typed/pasted input: bracketed-paste markers (ESC[200~ / ESC[201~, sent by many
 * terminals over SSH when you paste), other escape sequences, control characters and the line ending. Without
 * this, a pasted password is stored with invisible bytes and the same password typed into a browser never matches.
 */
export function sanitizeTerminalInput(raw: string): string {
  // Matching control characters is the whole point of this function.
  /* oxlint-disable no-control-regex */
  return raw
    .replace(/\u001b\[20[01]~/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "");
  /* oxlint-enable no-control-regex */
}

/** Read a line from the TTY without echoing it. Refuses to run without a TTY (no piping passwords). */
export async function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("This command must be run interactively (stdin is not a TTY).");
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(sanitizeTerminalInput(answer));
    });
    muted = true;
  });
}

export async function promptNewPassword(): Promise<string> {
  const first = await promptHidden("New password (12+ characters): ");
  const second = await promptHidden("Repeat password: ");
  if (first !== second) throw new Error("Passwords do not match.");
  // Lets the user confirm what was captured (e.g. after pasting) without revealing it.
  console.log(`Password captured: ${first.length} characters.`);
  return first;
}

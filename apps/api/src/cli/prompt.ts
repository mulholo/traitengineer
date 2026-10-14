import { createInterface } from "node:readline";
import { Writable } from "node:stream";

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
      resolve(answer);
    });
    muted = true;
  });
}

export async function promptNewPassword(): Promise<string> {
  const first = await promptHidden("New password (12+ characters): ");
  const second = await promptHidden("Repeat password: ");
  if (first !== second) throw new Error("Passwords do not match.");
  return first;
}

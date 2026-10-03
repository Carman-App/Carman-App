/**
 * Terminal questions for the setup scripts. One reader for every question,
 * with a queue so lines typed (or pasted) ahead of a question are kept.
 */
import { createInterface } from "node:readline";

export const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const lines = [];
const waiting = [];
let hiding = false;
const write = rl._writeToOutput?.bind(rl);
rl._writeToOutput = (s) => {
  if (!hiding) return write?.(s);
  if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
};
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on("close", () => {
  while (waiting.length) waiting.shift()("");
});

export function ask(question, { hidden = false, fallback = "" } = {}) {
  process.stdout.write(question);
  hiding = hidden && Boolean(process.stdin.isTTY);
  return new Promise((resolve) => {
    const done = (answer) => {
      hiding = false;
      if (hidden && !process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer.trim() || fallback);
    };
    if (lines.length) done(lines.shift());
    else waiting.push(done);
  });
}

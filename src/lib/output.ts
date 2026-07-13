import pc from "picocolors";

/** A user-facing error with a clean message (no stack) and an exit code. */
export class CliError extends Error {
  exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export const log = {
  info: (msg: string) => console.log(msg),
  step: (msg: string) => console.log(`${pc.dim("›")} ${msg}`),
  ok: (msg: string) => console.log(`${pc.green("✓")} ${msg}`),
  warn: (msg: string) => console.log(`${pc.yellow("!")} ${msg}`),
  error: (msg: string) => console.error(`${pc.red("✗")} ${msg}`),
};

export { pc };

/** The CLI's own version, from package.json. */
import { createRequire } from "node:module";
export const CLI_VERSION: string = (createRequire(import.meta.url)("../../package.json") as { version: string }).version;

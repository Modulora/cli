import { CliError, log } from "./output.js";

/**
 * Wrap a command body so expected failures print a clean one-line message and
 * exit with the right code, instead of citty dumping a stack trace.
 */
export async function guard(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof CliError) {
      log.error(err.message);
      process.exit(err.exitCode);
    }
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

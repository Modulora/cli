import { defineCommand } from "citty";
import { localFileState, readLockfile } from "../lib/lockfile.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

export const verifyCommand = defineCommand({
  meta: { name: "verify", description: "Check installed components against modulora.lock (detect local changes)." },
  args: {
    json: { type: "boolean", description: "Machine-readable output" },
    cwd: { type: "string", description: "Project directory (default: current)" },
  },
  async run({ args }) {
    await guard(async () => {
      const cwd = args.cwd ? String(args.cwd) : process.cwd();
      const lock = readLockfile(cwd);
      const refs = Object.keys(lock.components);
      if (refs.length === 0) throw new CliError("No components in modulora.lock — nothing to verify.");

      const report = refs.map((ref) => {
        const entry = lock.components[ref]!;
        const files = entry.files.map((file) => ({ path: file.path, state: localFileState(cwd, file) }));
        const state = files.every((f) => f.state === "intact")
          ? "intact"
          : files.some((f) => f.state === "missing")
            ? "missing-files"
            : "modified";
        return { ref, version: entry.version, digest: entry.digest, state, files };
      });

      if (args.json) {
        console.log(JSON.stringify({ components: report }, null, 2));
        return;
      }
      for (const item of report) {
        const badge =
          item.state === "intact"
            ? pc.green("✓ intact")
            : item.state === "modified"
              ? pc.yellow("~ locally modified")
              : pc.red("✗ files missing");
        log.info(`${pc.bold(item.ref)}@${item.version}  ${badge}`);
        for (const file of item.files) {
          if (file.state !== "intact") {
            log.info(`  ${file.state === "missing" ? pc.red("missing ") : pc.yellow("modified")}  ${file.path}`);
          }
        }
      }
      const dirty = report.filter((r) => r.state !== "intact").length;
      if (dirty > 0) process.exitCode = 1;
    });
  },
});

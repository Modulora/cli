import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { defineCommand } from "citty";
import { verifyItem } from "../lib/verify.js";
import { recordInstall } from "../lib/lockfile.js";
import { registryUrl } from "../config.js";
import { computeDiff } from "./diff.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

export const updateCommand = defineCommand({
  meta: { name: "update", description: "Apply the latest release — never discards local edits." },
  args: {
    ref: { type: "positional", description: "@user/name", required: true },
    "dry-run": { type: "boolean", description: "Show the plan without writing anything" },
    json: { type: "boolean", description: "Machine-readable plan/result" },
    cwd: { type: "string", description: "Project directory (default: current)" },
  },
  async run({ args }) {
    await guard(async () => {
      const cwd = args.cwd ? String(args.cwd) : process.cwd();
      const diff = await computeDiff(String(args.ref), cwd);

      // 1. Verify the upstream release before touching anything.
      const verify = verifyItem(diff.item);
      if (verify.status === "mismatch") {
        throw new CliError(
          `Digest mismatch on the upstream release of ${diff.bareRef} — refusing to update.\n  published: ${verify.expected}\n  received:  ${verify.computed}`,
        );
      }

      // 2. Never discard local work: conflicts stop the update entirely.
      const conflicts = diff.files.filter((f) => f.state === "conflict");
      if (conflicts.length > 0) {
        throw new CliError(
          `Local edits collide with upstream changes in:\n${conflicts.map((f) => `  ${f.path}`).join("\n")}\n` +
            `Resolve manually: your edits are preserved on disk. Compare with \`modulora diff ${diff.bareRef}\`.`,
        );
      }

      const applies = diff.files.filter((f) => f.state === "update" || f.state === "new");
      if (applies.length === 0) {
        if (args.json) console.log(JSON.stringify({ ref: diff.bareRef, updated: false, reason: "up-to-date" }));
        else log.ok(`${diff.bareRef} is already up to date.`);
        return;
      }

      if (args.json) {
        console.log(JSON.stringify({ ref: diff.bareRef, from: diff.installedVersion, to: diff.upstreamVersion, files: applies, written: !args["dry-run"] }, null, 2));
        if (args["dry-run"]) return;
      } else {
        log.info(`${pc.bold(diff.bareRef)}  ${pc.dim(`v${diff.installedVersion}`)} → ${pc.bold(`v${diff.upstreamVersion}`)}`);
        for (const file of applies) log.info(`  ${file.state === "new" ? pc.green("create") : pc.cyan("update")}  ${file.path}`);
        if (args["dry-run"]) return;
      }

      // 3. Write only the applying files (local-edit files stay untouched).
      const upstreamByPath = new Map(diff.targets.map((t, i) => [t.displayPath, { abs: t.absPath, content: diff.item.files[i]!.content }]));
      for (const file of applies) {
        const upstream = upstreamByPath.get(file.path)!;
        mkdirSync(dirname(upstream.abs), { recursive: true });
        writeFileSync(upstream.abs, upstream.content, "utf8");
      }

      // 4. Re-record the lockfile: applied files get upstream hashes; files
      // with local edits keep their PREVIOUS recorded hash, so `verify`
      // keeps flagging them — we never pretend edited files are clean.
      const previous = new Map(diff.files.map((f) => [f.path, f.state]));
      const { readLockfile } = await import("../lib/lockfile.js");
      const oldEntry = readLockfile(cwd).components[diff.bareRef];
      const oldHashByPath = new Map(oldEntry?.files.map((f) => [f.path, f.sha256]) ?? []);
      recordInstall(cwd, diff.bareRef, {
        version: diff.upstreamVersion,
        digest: verify.expected,
        registry: registryUrl(),
        files: diff.targets.map((t, i) => {
          const applied = applies.some((f) => f.path === t.displayPath);
          if (applied) return { displayPath: t.displayPath, content: diff.item.files[i]!.content };
          const oldHash = oldHashByPath.get(t.displayPath);
          return oldHash
            ? { displayPath: t.displayPath, sha256: oldHash }
            : { displayPath: t.displayPath, content: diff.item.files[i]!.content };
        }),
      });

      if (!args.json) log.ok(`Updated ${diff.bareRef} to v${diff.upstreamVersion} (${applies.length} file(s)).`);
    });
  },
});

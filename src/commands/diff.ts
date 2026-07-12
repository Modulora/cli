import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { fetchRegistryItem, parseRef } from "../lib/registry.js";
import { resolveTargets } from "../lib/project.js";
import { fileHash, localFileState, readLockfile } from "../lib/lockfile.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

/**
 * Per-file comparison between the installed release (lockfile), the local
 * working copy, and the latest upstream release:
 *
 *   unchanged   upstream == installed, local intact
 *   update      upstream changed, local intact  → safe to apply
 *   local-edit  upstream == installed, local modified → nothing to pull
 *   conflict    upstream changed AND local modified → needs a human
 *   new         file exists upstream but not in the installed release
 *   removed     file was installed but no longer ships upstream
 */
export type FileDiff = "unchanged" | "update" | "local-edit" | "conflict" | "new" | "removed";

export async function computeDiff(ref: string, cwd: string) {
  const parsed = parseRef(ref);
  const bareRef = `@${parsed.namespace}/${parsed.name}`;
  const lock = readLockfile(cwd);
  const installed = lock.components[bareRef];
  if (!installed) throw new CliError(`${bareRef} is not in modulora.lock — install it first with \`modulora add\`.`);

  const item = await fetchRegistryItem(ref);
  const targets = resolveTargets(item.files, cwd);

  const upstreamByPath = new Map(targets.map((t, i) => [t.displayPath, item.files[i]!.content]));
  const installedByPath = new Map(installed.files.map((f) => [f.path, f]));

  const files: { path: string; state: FileDiff }[] = [];
  for (const [path, upstreamContent] of upstreamByPath) {
    const locked = installedByPath.get(path);
    if (!locked) {
      files.push({ path, state: "new" });
      continue;
    }
    const upstreamChanged = fileHash(upstreamContent) !== locked.sha256;
    const local = localFileState(cwd, locked);
    const locallyModified = local !== "intact";
    files.push({
      path,
      state: upstreamChanged && locallyModified ? "conflict" : upstreamChanged ? "update" : locallyModified ? "local-edit" : "unchanged",
    });
  }
  for (const [path] of installedByPath) {
    if (!upstreamByPath.has(path)) files.push({ path, state: "removed" });
  }

  return {
    bareRef,
    installedVersion: installed.version,
    upstreamVersion: item.meta?.version ?? "",
    item,
    targets,
    files,
  };
}

export const diffCommand = defineCommand({
  meta: { name: "diff", description: "Compare an installed component to the latest release." },
  args: {
    ref: { type: "positional", description: "@user/name", required: true },
    json: { type: "boolean", description: "Machine-readable output" },
    cwd: { type: "string", description: "Project directory (default: current)" },
  },
  async run({ args }) {
    await guard(async () => {
      const cwd = args.cwd ? String(args.cwd) : process.cwd();
      const diff = await computeDiff(String(args.ref), cwd);

      if (args.json) {
        console.log(JSON.stringify({ ref: diff.bareRef, installed: diff.installedVersion, upstream: diff.upstreamVersion, files: diff.files }, null, 2));
        return;
      }
      const versionNote =
        diff.installedVersion === diff.upstreamVersion
          ? pc.dim(`v${diff.installedVersion} (latest)`)
          : `${pc.dim(`v${diff.installedVersion}`)} → ${pc.bold(`v${diff.upstreamVersion}`)}`;
      log.info(`${pc.bold(diff.bareRef)}  ${versionNote}`);
      log.info("");
      const label: Record<FileDiff, string> = {
        unchanged: pc.dim("unchanged "),
        update: pc.cyan("update    "),
        "local-edit": pc.yellow("local edit"),
        conflict: pc.red("conflict  "),
        new: pc.green("new       "),
        removed: pc.magenta("removed   "),
      };
      for (const file of diff.files) log.info(`  ${label[file.state]}  ${file.path}`);
      if (diff.files.every((f) => f.state === "unchanged")) {
        log.info(pc.dim("\n  Everything up to date and unmodified."));
      } else if (diff.files.some((f) => f.state === "update" || f.state === "new")) {
        log.info(pc.dim("\n  Apply upstream changes with: ") + pc.cyan(`modulora update ${diff.bareRef}`));
      }
    });
  },
});

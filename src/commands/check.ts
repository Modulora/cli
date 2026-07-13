import { existsSync, readFileSync } from "node:fs";
import { defineCommand } from "citty";
import { fetchRegistryItem, parseRef } from "../lib/registry.js";
import { resolveTargets } from "../lib/project.js";
import { verifyItem } from "../lib/verify.js";
import { fileHash, recordInstall } from "../lib/lockfile.js";
import { registryUrl } from "../config.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

/**
 * `modulora check` — verify a component that was installed WITHOUT the
 * Modulora CLI (e.g. `shadcn add`) against the published release. shadcn's
 * client doesn't verify digests; parity comes from /r/ serving one payload
 * to every client, and this command proves it after the fact: it verifies
 * the upstream digest, then compares your on-disk bytes to the verified
 * files. `--save` records the result into modulora.lock so verify/diff/
 * update work from then on.
 */
export const checkCommand = defineCommand({
  meta: { name: "check", description: "Verify an installed component against the published release (no lockfile needed)." },
  args: {
    ref: { type: "positional", description: "@user/name or @user/name@version", required: true },
    save: { type: "boolean", description: "Record a clean result into modulora.lock (adopt the install)" },
    json: { type: "boolean", description: "Machine-readable output" },
    cwd: { type: "string", description: "Project directory (default: current)" },
  },
  async run({ args }) {
    await guard(async () => {
      const ref = String(args.ref);
      const cwd = args.cwd ? String(args.cwd) : process.cwd();

      // 1. The upstream release itself must verify before it's a yardstick.
      const item = await fetchRegistryItem(ref);
      if (item.files.length === 0) throw new CliError(`${ref} has no installable source to check against.`);
      const verify = verifyItem(item);
      if (verify.status === "mismatch") {
        throw new CliError(
          `The upstream release of ${ref} fails its own digest — nothing to trust here.\n  published: ${verify.expected}\n  received:  ${verify.computed}`,
        );
      }

      // 2. Compare on-disk bytes to the verified files.
      const targets = resolveTargets(item.files, cwd);
      const files = targets.map((target, index) => {
        if (!existsSync(target.absPath)) return { path: target.displayPath, state: "missing" as const };
        const disk = readFileSync(target.absPath, "utf8");
        // Normalize line endings the same way the digest does.
        const match = fileHash(disk.replace(/\r\n/g, "\n")) === fileHash(item.files[index]!.content.replace(/\r\n/g, "\n"));
        return { path: target.displayPath, state: match ? ("match" as const) : ("modified" as const) };
      });
      const clean = files.every((file) => file.state === "match");

      if (args.json) {
        console.log(JSON.stringify({ ref, version: item.meta?.version ?? "", digest: verify.expected, upstream: verify.status, clean, files }, null, 2));
      } else {
        const badge = clean
          ? pc.green("✓ matches the published release byte-for-byte")
          : pc.yellow("~ differs from the published release");
        log.info(`${pc.bold(ref)}${item.meta?.version ? pc.dim(`@${item.meta.version}`) : ""}  ${badge}`);
        if (verify.expected) log.info(pc.dim(`  digest ${verify.expected.slice(0, 24)}… (${verify.status})`));
        for (const file of files) {
          if (file.state !== "match") {
            log.info(`  ${file.state === "missing" ? pc.red("missing ") : pc.yellow("modified")}  ${file.path}`);
          }
        }
      }

      // 3. Optionally adopt a clean install into the lockfile.
      if (args.save) {
        if (!clean) throw new CliError("Refusing to --save: on-disk files differ from the published release.");
        const parsed = parseRef(ref);
        recordInstall(cwd, `@${parsed.namespace}/${parsed.name}`, {
          version: item.meta?.version ?? parsed.version ?? "",
          digest: verify.expected,
          registry: registryUrl(),
          files: targets.map((target, index) => ({ displayPath: target.displayPath, content: item.files[index]!.content })),
        });
        if (!args.json) log.ok("Recorded in modulora.lock — verify/diff/update now cover it.");
      }

      if (!clean) process.exitCode = 1;
    });
  },
});

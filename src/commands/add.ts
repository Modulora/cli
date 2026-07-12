import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { defineCommand } from "citty";
import { fetchRegistryItem, parseRef, sendInstallReceipt } from "../lib/registry.js";
import { resolveTargets } from "../lib/project.js";
import { verifyItem } from "../lib/verify.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

export const addCommand = defineCommand({
  meta: { name: "add", description: "Install a component into your project after verifying its digest." },
  args: {
    ref: { type: "positional", description: "@user/name or @user/name@version", required: true },
    "dry-run": { type: "boolean", description: "Show the plan without writing anything" },
    yes: { type: "boolean", alias: "y", description: "Do not prompt before overwriting files" },
    force: { type: "boolean", description: "Write even if the digest is unverifiable or mismatches" },
    json: { type: "boolean", description: "Machine-readable plan/result" },
    cwd: { type: "string", description: "Project directory (default: current)" },
  },
  async run({ args }) {
   await guard(async () => {
    const ref = String(args.ref);
    const cwd = args.cwd ? String(args.cwd) : process.cwd();
    const json = Boolean(args.json);

    const item = await fetchRegistryItem(ref);
    if (item.files.length === 0) {
      throw new CliError(
        `${ref} has no installable source. Paid or external components are purchased/installed from modulora.dev.`,
      );
    }

    // 1. Verify before we touch the disk.
    const verify = verifyItem(item);
    if (verify.status === "mismatch" && !args.force) {
      throw new CliError(
        `Digest mismatch for ${ref}. The files received do not match the published digest.\n` +
          `  published: ${verify.expected}\n  received:  ${verify.computed}\n` +
          `Refusing to write. Re-run with --force only if you understand the risk.`,
      );
    }

    // 2. Build the write plan.
    const targets = resolveTargets(item.files, cwd);
    const plan = targets.map((t, i) => ({
      registryPath: t.registryPath,
      path: t.displayPath,
      exists: t.exists,
      bytes: Buffer.byteLength(item.files[i]!.content, "utf8"),
    }));

    if (json) {
      console.log(JSON.stringify({ ref, verify, dependencies: item.dependencies ?? [], plan, written: !args["dry-run"] && verify.status !== "unverifiable" }, null, 2));
      if (args["dry-run"]) return;
    } else {
      printPlan(ref, verify, plan, item.dependencies ?? []);
    }

    if (args["dry-run"]) return;

    // 3. Confirm when we can't verify, or when we'd overwrite.
    if (verify.status === "unverifiable" && !args.force && !json) {
      const proceed = await confirm("This release has no published digest, so it can't be verified. Install anyway?");
      if (!proceed) throw new CliError("Aborted.", 130);
    } else if (verify.status === "unverifiable" && !args.force && json) {
      throw new CliError("Unverifiable release; pass --force to install non-interactively.");
    }

    const overwrites = plan.filter((p) => p.exists);
    if (overwrites.length > 0 && !args.yes && !json) {
      const proceed = await confirm(`${overwrites.length} file(s) already exist and will be overwritten. Continue?`);
      if (!proceed) throw new CliError("Aborted.", 130);
    } else if (overwrites.length > 0 && !args.yes && json) {
      throw new CliError("Existing files would be overwritten; pass --yes to overwrite non-interactively.");
    }

    // 4. Write.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      mkdirSync(dirname(t.absPath), { recursive: true });
      writeFileSync(t.absPath, item.files[i]!.content, "utf8");
    }

    // 5. Report the install (best effort; the server re-verifies the digest).
    const parsed = parseRef(ref);
    await sendInstallReceipt({
      namespace: parsed.namespace,
      name: parsed.name,
      version: item.meta?.version ?? parsed.version ?? "",
      digest: verify.computed,
    });

    if (!json) {
      log.ok(`Installed ${plan.length} file(s) from ${pc.bold(ref)}.`);
      if (item.dependencies?.length) {
        log.info("");
        log.step(`Install its npm dependencies:`);
        log.info(`  ${pc.cyan(depCommand(item.dependencies))}`);
      }
    }
   });
  },
});

function printPlan(
  ref: string,
  verify: ReturnType<typeof verifyItem>,
  plan: { path: string; exists: boolean; bytes: number }[],
  deps: string[],
) {
  const badge =
    verify.status === "verified"
      ? pc.green("✓ verified")
      : verify.status === "mismatch"
        ? pc.red("✗ digest mismatch")
        : pc.yellow("! unverifiable (no published digest)");
  log.info(`${pc.bold(ref)}  ${badge}`);
  if (verify.expected) log.info(pc.dim(`  digest ${verify.expected.slice(0, 24)}…`));
  log.info("");
  for (const p of plan) {
    const tag = p.exists ? pc.yellow("overwrite") : pc.green("create");
    log.info(`  ${tag}  ${p.path}  ${pc.dim(`${p.bytes} B`)}`);
  }
  if (deps.length) log.info(pc.dim(`\n  dependencies: ${deps.join(", ")}`));
  log.info("");
}

function depCommand(deps: string[]): string {
  return `npm install ${deps.join(" ")}`;
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new CliError(`${question} (no TTY — pass --yes or --force to run non-interactively)`);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} ${pc.dim("[y/N]")} `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

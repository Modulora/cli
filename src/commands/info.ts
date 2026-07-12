import { defineCommand } from "citty";
import { fetchRegistryItem } from "../lib/registry.js";
import { verifyItem } from "../lib/verify.js";
import { guard } from "../lib/run.js";
import { log, pc } from "../lib/output.js";

export const infoCommand = defineCommand({
  meta: { name: "info", description: "Show a component's metadata, files, and published digest." },
  args: {
    ref: { type: "positional", description: "@user/name or @user/name@version", required: true },
    json: { type: "boolean", description: "Machine-readable output" },
  },
  async run({ args }) {
   await guard(async () => {
    const item = await fetchRegistryItem(String(args.ref));
    const verify = verifyItem(item);

    if (args.json) {
      console.log(JSON.stringify({ item, verify }, null, 2));
      return;
    }

    log.info(pc.bold(item.title || item.name));
    if (item.description) log.info(pc.dim(item.description));
    log.info("");
    log.info(`${pc.dim("name")}     ${item.name}`);
    if (item.meta?.version) log.info(`${pc.dim("version")}  ${item.meta.version}`);
    log.info(
      `${pc.dim("digest")}   ${
        verify.expected
          ? `${verify.expected.slice(0, 16)}… ${verify.status === "verified" ? pc.green("(verifiable)") : pc.red("(mismatch)")}`
          : pc.yellow("not published")
      }`,
    );
    if (item.dependencies?.length) {
      log.info(`${pc.dim("deps")}     ${item.dependencies.join(", ")}`);
    }
    log.info("");
    log.info(pc.dim(`files (${item.files.length})`));
    for (const f of item.files) log.info(`  ${f.path}`);
   });
  },
});

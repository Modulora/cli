import { defineCommand } from "citty";
import { registryUrl } from "../config.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

interface SearchResult {
  ref: string;
  title: string;
  description: string;
  category: string;
  paid: boolean;
  price: number | null;
  url: string;
}

export const searchCommand = defineCommand({
  meta: { name: "search", description: "Search the public catalog." },
  args: {
    query: { type: "positional", description: "What to search for", required: true },
    json: { type: "boolean", description: "Machine-readable output" },
    limit: { type: "string", description: "Max results (default 20)" },
  },
  async run({ args }) {
    await guard(async () => {
      const params = new URLSearchParams({ q: String(args.query) });
      if (args.limit) params.set("limit", String(args.limit));
      let res: Response;
      try {
        res = await fetch(`${registryUrl()}/api/search?${params}`, { headers: { accept: "application/json" } });
      } catch (err) {
        throw new CliError(`Could not reach the registry at ${registryUrl()} (${(err as Error).message}).`);
      }
      if (!res.ok) throw new CliError(`Search failed (registry returned ${res.status}).`);
      const data = (await res.json()) as { results: SearchResult[] };

      if (args.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      if (data.results.length === 0) {
        log.info(pc.dim("No components matched."));
        return;
      }
      for (const item of data.results) {
        const price = item.paid ? pc.yellow(item.price != null ? ` $${(item.price / 100).toFixed(2)}` : " paid") : "";
        log.info(`${pc.bold(item.ref)}${price}  ${pc.dim(item.category)}`);
        if (item.description) log.info(`  ${pc.dim(item.description.slice(0, 100))}`);
      }
      log.info("");
      log.info(pc.dim(`Install with: modulora add <ref>`));
    });
  },
});

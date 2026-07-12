import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { createInterface } from "node:readline/promises";
import { defineCommand } from "citty";
import { registryUrl } from "../config.js";
import { authHeaders, getToken } from "../lib/auth.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

/**
 * `modulora publish` — publish a component from a local registry-item
 * manifest. A thin authenticated client over the same publish endpoint the
 * web editor uses: identical validation, namespace ownership enforced by
 * the server, and every submission still goes through curator review.
 *
 * Manifest (registry-item.json, shadcn-compatible):
 * {
 *   "name": "live-counter",
 *   "title": "Live Counter",
 *   "description": "…",
 *   "category": "layout",
 *   "files": [{ "path": "src/components/ui/live-counter.tsx" }]
 * }
 * File contents load from disk relative to the manifest. Paths under
 * src/demos/ are preview-only; src/components/** is what installs.
 */
interface Manifest {
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  files?: { path?: string }[];
}

export const publishCommand = defineCommand({
  meta: { name: "publish", description: "Publish a component from a local registry-item manifest." },
  args: {
    manifest: { type: "positional", description: "Path to registry-item.json (default: ./registry-item.json)", required: false },
    "accept-policy": { type: "boolean", description: "Accept the publishing policy non-interactively (CI)" },
    json: { type: "boolean", description: "Machine-readable result" },
  },
  async run({ args }) {
    await guard(async () => {
      if (!getToken()) throw new CliError("Sign in first: `modulora login`.");

      const manifestPath = String(args.manifest ?? "registry-item.json");
      if (!existsSync(manifestPath)) {
        throw new CliError(`Manifest not found: ${manifestPath}\nCreate a registry-item.json describing the component.`);
      }
      let manifest: Manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
      } catch {
        throw new CliError(`${manifestPath} is not valid JSON.`);
      }
      const baseDir = join(manifestPath, "..");

      const fileEntries = Array.isArray(manifest.files) ? manifest.files : [];
      if (fileEntries.length === 0) throw new CliError("The manifest lists no files.");
      const files = fileEntries.map((entry) => {
        const path = String(entry?.path ?? "").trim();
        if (!path) throw new CliError("A manifest file entry is missing its path.");
        if (isAbsolute(path) || normalize(path).startsWith("..")) {
          throw new CliError(`Unsafe file path in manifest: ${path}`);
        }
        const abs = join(baseDir, path);
        if (!existsSync(abs)) throw new CliError(`File listed in the manifest doesn't exist: ${path}`);
        return { path, content: readFileSync(abs, "utf8") };
      });

      // Publishing policy: explicit acceptance, same as the editor checkbox.
      if (!args["accept-policy"]) {
        if (!process.stdin.isTTY) {
          throw new CliError("Pass --accept-policy to publish non-interactively (read it at https://modulora.dev/publishing-policy).");
        }
        log.info(`Publishing means accepting the policy: ${pc.dim("https://modulora.dev/publishing-policy")}`);
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try {
          const answer = (await rl.question(`Accept and submit for review? ${pc.dim("[y/N]")} `)).trim().toLowerCase();
          if (answer !== "y" && answer !== "yes") throw new CliError("Aborted.", 130);
        } finally {
          rl.close();
        }
      }

      const res = await fetch(`${registryUrl()}/api/publish`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: manifest.name,
          title: manifest.title,
          description: manifest.description,
          category: manifest.category,
          files,
          acceptPolicy: true,
        }),
      });
      const result = (await res.json()) as { ok: boolean; error?: string; namespace?: string; name?: string; version?: string };

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) process.exitCode = 1;
        return;
      }
      if (!result.ok) throw new CliError(result.error ?? `Publish failed (${res.status}).`);
      log.ok(`Submitted ${pc.bold(`@${result.namespace}/${result.name}`)}@${result.version} for review.`);
      log.info(pc.dim("  A curator reviews every submission before it lists publicly."));
      log.info(pc.dim(`  Track it: ${registryUrl()}/dashboard/components`));
    });
  },
});

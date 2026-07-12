/**
 * `modulora mcp` — a read-only MCP server (stdio) exposing Modulora discovery
 * to AI agents: search the public catalog, fetch a component's registry item
 * (files + published digest for free components; price + purchase URL for
 * paid ones — source never leaks), and get verified install commands.
 *
 * Read-only by design: any write (installing files) goes through the same
 * `modulora add` plan/approval path a human uses, never through MCP.
 */
import { defineCommand } from "citty";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registryUrl } from "../config.js";
import { fetchRegistryItem } from "../lib/registry.js";
import { verifyItem } from "../lib/verify.js";
import { CliError } from "../lib/output.js";

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export const mcpCommand = defineCommand({
  meta: { name: "mcp", description: "Run a read-only MCP server for AI agents (stdio)." },
  async run() {
    const server = new McpServer({ name: "modulora", version: "0.0.0" });

    server.registerTool(
      "search_components",
      {
        description:
          "Search Modulora's public component catalog. Returns refs (@user/name), titles, descriptions, and whether each component is paid.",
        inputSchema: {
          query: z.string().describe("What to search for"),
          limit: z.number().optional().describe("Max results (default 20)"),
        },
      },
      async ({ query, limit }) => {
        const params = new URLSearchParams({ q: query });
        if (limit) params.set("limit", String(limit));
        const res = await fetch(`${registryUrl()}/api/search?${params}`, { headers: { accept: "application/json" } });
        if (!res.ok) return text({ error: `Search failed (${res.status})` });
        return text(await res.json());
      },
    );

    server.registerTool(
      "get_component",
      {
        description:
          "Fetch a component's registry item by ref (@user/name or @user/name@version): metadata, files, and the published content digest. Paid components return price + purchase URL instead of source.",
        inputSchema: {
          ref: z.string().describe("Component reference, e.g. @creator/calendar"),
        },
      },
      async ({ ref }) => {
        try {
          const item = await fetchRegistryItem(ref);
          const verify = verifyItem(item);
          return text({ item, verification: verify });
        } catch (error) {
          if (error instanceof CliError) return text({ error: error.message });
          throw error;
        }
      },
    );

    server.registerTool(
      "get_install_command",
      {
        description:
          "Get the install commands for a component. The Modulora CLI path verifies the published content digest; never bypass a digest mismatch.",
        inputSchema: {
          ref: z.string().describe("Component reference, e.g. @creator/calendar"),
        },
      },
      async ({ ref }) => {
        return text({
          verified: `npx modulora add ${ref}`,
          shadcn: `npx shadcn@latest add ${registryUrl()}/r/${ref}`,
          notes: [
            "The modulora CLI recomputes the content digest locally and refuses to write on a mismatch — do not use --force.",
            "Purchased components require `npx modulora login` first.",
            "Install any npm dependencies the CLI reports after installing.",
          ],
        });
      },
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Keep the process alive; the transport closes when the client disconnects.
    await new Promise(() => {});
  },
});

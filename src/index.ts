#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { infoCommand } from "./commands/info.js";
import { loginCommand, logoutCommand, whoamiCommand } from "./commands/login.js";
import { searchCommand } from "./commands/search.js";
import { mcpCommand } from "./commands/mcp.js";
import { verifyCommand } from "./commands/verify.js";
import { diffCommand } from "./commands/diff.js";
import { updateCommand } from "./commands/update.js";
import { CliError, log } from "./lib/output.js";

const main = defineCommand({
  meta: {
    name: "modulora",
    version: "0.0.0",
    description: "Install and verify Modulora components.",
  },
  subCommands: {
    add: addCommand,
    info: infoCommand,
    search: searchCommand,
    mcp: mcpCommand,
    verify: verifyCommand,
    diff: diffCommand,
    update: updateCommand,
    login: loginCommand,
    whoami: whoamiCommand,
    logout: logoutCommand,
  },
});

runMain(main).catch((err: unknown) => {
  if (err instanceof CliError) {
    log.error(err.message);
    process.exit(err.exitCode);
  }
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

/**
 * Tegami release entry (cli#5): changelogs from conventional commits,
 * version bumps, and a publish lock consumed by CI. The generated
 * CHANGELOG.md also feeds the site's changelog docs page.
 */
import { tegami } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";

const paper = tegami({
  plugins: [
    github({
      repo: "Modulora/cli",
      versionPr: { base: "main" },
    }),
  ],
});

await runCli(paper);

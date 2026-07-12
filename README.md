# Modulora CLI

Inspect, install, and **verify** components from Modulora. Every install is
checked byte-for-byte against the digest that was published — and the CLI only
ever writes files. It never runs an install script.

```bash
# Inspect a component (metadata, files, published digest)
modulora info @creator/calendar

# Preview the exact writes without touching disk
modulora add @creator/calendar --dry-run

# Install after verifying the digest
modulora add @creator/calendar
```

## Install

```bash
npm install -g modulora   # or: pnpm add -g modulora
```

Requires Node.js 20+.

## Commands (v0)

### `modulora info <@user/name[@version]>`

Prints the component's title, description, version, published content digest,
npm dependencies, and file list. `--json` for machine-readable output.

### `modulora add <@user/name[@version]>`

Fetches the release, **recomputes its content digest locally and compares it to
the published digest**, shows a write plan, then writes the files.

| Flag | Effect |
|---|---|
| `--dry-run` | Show the plan and verification result; write nothing. |
| `--yes`, `-y` | Don't prompt before overwriting existing files. |
| `--force` | Write even if the digest is unverifiable or mismatches (use with care). |
| `--json` | Machine-readable plan/result (for agents and CI). |
| `--cwd <dir>` | Target project directory (default: current). |

Verification outcomes:

- **verified** — the received files match the published digest exactly.
- **mismatch** — they do not; `add` refuses to write unless you pass `--force`.
- **unverifiable** — the release published no digest; `add` asks before writing.

Files land under `src/` when the project has a `src/` directory, otherwise at
the project root. The CLI refuses any path that escapes the project.

### `modulora mcp`

Read-only MCP server (stdio) for AI agents: `search_components`,
`get_component` (registry item + published digest; paid returns price +
purchase URL, never source), `get_install_command`. Writes always go through
`modulora add`.

### Configuration

`MODULORA_REGISTRY_URL` overrides the registry origin (default
`https://modulora.dev`) for self-hosting or local development.

## Security model

The installer resolves a release, verifies its content digest, shows a plan
before writes, enforces safe target paths, and writes only files.

It does **not** execute creator-provided shell commands or lifecycle scripts.
Signature verification, atomic apply + rollback, `modulora.lock`, authenticated
publishing, and read-only MCP discovery are planned — see `PLAN.md`.

See [`CHECKLIST.md`](./CHECKLIST.md) for implementation gates.

## Build plan

- [`PLAN.md`](./PLAN.md) — self-contained scope, dependencies, milestones, acceptance criteria, security/test gates, and definition of done.
- [`CHECKLIST.md`](./CHECKLIST.md) — concise progress tracker.

## License

Apache License 2.0.

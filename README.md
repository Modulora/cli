# Modulora CLI

Securely discover, inspect, install, and verify components from Modulora.

```bash
modulora search "accessible date picker"
modulora info @creator/calendar
modulora add @creator/calendar@1.2.0 --dry-run
modulora diff @creator/calendar@1.2.0
modulora add @creator/calendar@1.2.0
modulora verify
```

> The CLI is not implemented yet. The command surface above is the planned contract.

## Security model

The installer will resolve immutable releases, verify signatures and digests, show a plan before writes, enforce safe target paths, apply changes atomically, support rollback, and write `modulora.lock`.

It will not execute creator-provided shell commands or lifecycle scripts. MCP discovery will remain read-only until the installer receives independent security review.

See [`CHECKLIST.md`](./CHECKLIST.md) for implementation gates.

## License

Apache License 2.0.

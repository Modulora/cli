# CLI Build Plan

> Repository: `Modulora/cli` · Status: approved planning baseline

## Mission

Build a secure, agent-friendly CLI that discovers, inspects, installs, verifies, and updates exact Modulora component releases while making every local change predictable, reviewable, atomic, and recoverable.

## Ownership boundary

This repository owns:

- CLI commands and machine-readable output;
- public API client integration;
- spec/attestation/evidence verification;
- project detection and install planning;
- filesystem/dependency/config safety policy;
- atomic writes, rollback, and `modulora.lock`;
- CLI authentication/token storage for future private access;
- npm release pipeline.

It does not own catalog data, account authorization, publishing, schema definitions, cloud entitlements, or arbitrary creator scripts.

## Dependencies

- `@modulora/spec` schemas, types, canonical vectors, and malicious fixtures.
- Core public/staging API and revocation semantics.
- `.github` package ownership, security reporting, and release protections.
- Cloud may provide short-lived scoped grants later; CLI never embeds cloud-private logic.

## Command contract

```bash
modulora search "accessible date picker"
modulora info @creator/calendar
modulora add @creator/calendar@1.2.0 --dry-run
modulora diff @creator/calendar@1.2.0
modulora add @creator/calendar@1.2.0
modulora verify
modulora update @creator/calendar --dry-run
```

Every command supports stable exit codes. Discovery/inspection support `--json`; write commands return a structured plan/result for agents and CI.

## Proposed package shape

```text
packages/
  cli/                 # command parsing and terminal UX
  api-client/          # generated/wrapped public API client
  verifier/            # canonicalization, signatures, revocation
  project/             # framework/package-manager/config detection
  installer/           # plan, policy, staging, apply, rollback
  lockfile/            # modulora.lock schema and local state
fixtures/
  projects/
  registries/
  filesystem-attacks/
```

## Milestone 0 — Foundation

### Deliverables

- TypeScript workspace and runtime decision based on current ecosystem testing.
- Cross-platform CI on supported Node versions for macOS, Linux, and Windows.
- Command framework with stable errors, exit codes, logging, `--json`, and no accidental secret output.
- Package boundaries and dependency direction.
- Protected npm trusted publishing with provenance.

### Acceptance

- `modulora --help` and version output work across platforms.
- JSON output is schema-tested and stdout/stderr behavior is deterministic.
- Releases require protected environment review and no long-lived npm token.

## Milestone 1 — Discovery and inspection

### Deliverables

- `search` with filters and pagination.
- `info` showing creator, source model, framework compatibility, dependencies, versions, evidence, deprecation/revocation.
- External-commercial handoff metadata without pretending Modulora can install unseen source.
- Local/API cache with ETag and safe invalidation.

### Acceptance

- Read-only commands pass generated-client contract tests.
- Output always cites exact creator/component/version where relevant.
- Revoked releases are visually and machine-readably distinct.
- No authentication is required for public discovery.

## Milestone 2 — Verification engine

### Deliverables

- Strict parsing against exact `@modulora/spec` versions.
- Canonical digest calculation.
- Signature/key/namespace/version/source digest checks.
- Revocation and compromised-key cutoff handling.
- Evidence interpretation that preserves issuer/scope/time/limitations.
- `verify` for installed lockfile state.

### Acceptance

- Golden canonicalization vectors match spec.
- Unknown, malformed, mismatched, or revoked signatures fail closed.
- Verification never turns scan evidence into a “safe” claim.
- Offline verification works with cached trust metadata under documented freshness rules.

## Milestone 3 — Project detection and install plan

### Deliverables

- Detect project root, framework, language, package manager, aliases, styling system, and relevant config.
- Resolve shadcn registry item and dependencies to an exact immutable version.
- Produce file/dependency/config/environment/license plan.
- `--dry-run` and `diff` with human and JSON forms.
- Risk levels requiring explicit approval for dependency/config changes.

### Acceptance

- Detection fixtures cover representative React projects and monorepos.
- Plans are deterministic for identical inputs.
- Creator metadata cannot inject terminal control sequences or shell commands.
- No files or dependencies change during planning.

## Milestone 4 — Safe installation

### Required algorithm

1. Re-resolve exact version and verify attestation/revocation.
2. Validate every destination against project root and allowed target policy.
3. Stage files in a private temporary directory.
4. Re-check case collisions, symlinks/hardlinks, existing content, and race-sensitive state.
5. Ask for required approvals.
6. Apply atomically where possible; preserve rollback data.
7. Install dependencies through known package-manager arguments, never creator commands.
8. Write `modulora.lock` with source, version, digest, evidence reference, paths, and local hashes.
9. Verify resulting state and report rollback instructions.

### Acceptance

- Reject absolute paths, traversal, null bytes, device names, unsafe targets, case collisions, symlink/hardlink escapes, and workspace-boundary escapes.
- No arbitrary install/lifecycle script is accepted from registry metadata.
- Interrupted installation leaves original project recoverable.
- Rollback tests cover file, config, and dependency failures.
- Explicit opt-in is required before dependency or high-impact config changes.

## Milestone 5 — Update planning

### Deliverables

- Compare installed lockfile release to an exact candidate update.
- Detect local modifications and classify clean/conflicted paths.
- Produce update plan and three-way guidance without overwriting local work.
- Deprecation/revocation warning and safe replacement guidance.

### Acceptance

- Updates never run automatically or in the background.
- Local modifications are never silently discarded.
- Revoked installed versions produce actionable but non-destructive guidance.

## Milestone 6 — Authentication and agent integration

### Deliverables

- Browser/device login flow for future private registry access.
- OS-native secure credential storage where available.
- Short-lived scoped grants; no tokens in commands, query strings, logs, or lockfiles.
- Stable JSON interface for read-only MCP/search integrations.

### Acceptance

- Public commands work without login.
- Credential revocation/expiry is handled clearly.
- MCP remains read-only; any future write calls the same plan/approval path.

## Test and security contract

- Shared spec conformance suite.
- Property/fuzz tests for manifests, paths, canonicalization, lockfiles, and terminal output.
- Cross-platform filesystem attack fixtures.
- Golden install/rollback fixtures for package managers and project shapes.
- Dependency-confusion and malicious-registry fixtures.
- Independent security review before the first write-capable public beta.

## Explicit non-goals

- Executing creator-provided shell commands or lifecycle scripts.
- Automatically updating components.
- Hiding file/dependency changes from the user or agent.
- Installing external-commercial source not delivered by Modulora.
- Owning account/entitlement business rules.

## Definition of done

The install beta is ready when:

- discovery and verification contracts are stable;
- representative React projects install successfully at least 95% of the time;
- no known fixture escapes project boundaries;
- installation is atomic/recoverable under failure tests;
- signature/revocation behavior fails closed;
- independent security review findings are resolved;
- npm releases use trusted publishing and provenance.

## Handoffs

- File spec gaps as RFCs rather than adding private parser behavior.
- Give core API contract failures reproducible fixtures.
- Accept cloud tokens only through a published, scoped public contract.

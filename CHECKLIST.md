# CLI Checklist

## Foundation

- [ ] Confirm the command contract with user testing.
- [ ] Scaffold TypeScript package and reusable installer library.
- [ ] Add cross-platform CI for macOS, Linux, and Windows.
- [ ] Add structured output and stable exit codes for agents/CI.
- [ ] Configure protected npm trusted publishing and provenance.

## Discovery

- [ ] Implement `search` and `info` against the public API.
- [ ] Display creator, source model, compatibility, dependencies, and evidence.
- [ ] Support machine-readable JSON output.

## Verification

- [ ] Implement canonical manifest and attestation parsing.
- [ ] Verify signatures, digests, namespace, version, and revocation.
- [ ] Fail closed on invalid, unknown, revoked, or mismatched signatures.
- [ ] Distinguish platform evidence from creator claims.

## Installation safety

- [ ] Detect framework, package manager, styling system, and aliases.
- [ ] Implement `--dry-run`, `diff`, and explicit high-impact approvals.
- [ ] Reject absolute paths, traversal, null bytes, device paths, and case collisions.
- [ ] Reject symlink/hardlink escapes and writes outside approved roots.
- [ ] Reject arbitrary shell commands and package lifecycle scripts.
- [ ] Stage changes, apply atomically, preserve backups, and support rollback.
- [ ] Write `modulora.lock` with exact version, source, digest, and local modifications.

## Security release gate

- [ ] Add malicious registry fixtures and fuzz/property tests.
- [ ] Test signature/key revocation and compromised-release behavior.
- [ ] Confirm tokens never enter commands, query strings, logs, or lockfiles.
- [ ] Complete independent installer security review.
- [ ] Publish public checksums and release provenance.

## Agent integrations

- [ ] Stabilize CLI JSON contract before MCP integration.
- [ ] Add read-only MCP discovery and comparison.
- [ ] Require the same CLI approval path for any future agent writes.

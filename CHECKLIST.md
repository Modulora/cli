# CLI Checklist

## Foundation

- [ ] Confirm the command contract with user testing.
- [x] Scaffold TypeScript package and reusable installer library. _(v0: single package, ESM, citty)_
- [ ] Add cross-platform CI for macOS, Linux, and Windows.
- [x] Add structured output and stable exit codes for agents/CI. _(`--json`, clean errors, exit codes)_
- [ ] Configure protected npm trusted publishing and provenance.
- [ ] Set up Tegami release script (changelogs, version bumps, publish lock consumed by CI).

## Discovery

- [x] Implement `search` against the public API.
- [x] Implement `info` against the public registry (`/r/`).
- [~] Display creator, source model, compatibility, dependencies, and evidence. _(deps + digest done; creator/evidence pending an API surface)_
- [x] Support machine-readable JSON output.

## Installation (v0)

- [x] `modulora add` fetches a release and writes files (no scripts, ever).
- [x] Recompute the content digest locally and compare to the published digest.
- [x] `--dry-run` write plan; overwrite + unverifiable confirmations.
- [x] Server exposes the digest on `/r/` (`meta.contentSha256`); digest is canonical across publish, serve, and CLI.

## Verification

- [ ] Implement canonical manifest and attestation parsing.
- [~] Verify signatures, digests, namespace, version, and revocation. _(content digest done; signatures/revocation pending)_
- [x] Fail closed on digest mismatch (refuse to write unless `--force`).
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

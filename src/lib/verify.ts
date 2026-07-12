import { contentDigest } from "./digest.js";
import type { RegistryItem } from "./registry.js";

export type VerifyStatus = "verified" | "mismatch" | "unverifiable";

export interface VerifyResult {
  status: VerifyStatus;
  /** Digest computed locally over the files we received. */
  computed: string;
  /** Digest the registry published, if any. */
  expected: string | null;
}

/**
 * Recompute the digest over exactly the files we received and compare it to the
 * digest the registry published. `verified` means byte-for-byte match; the CLI
 * only ever writes these files and never runs an install script.
 */
export function verifyItem(item: RegistryItem): VerifyResult {
  const computed = contentDigest(item.files.map((f) => ({ path: f.path, content: f.content })));
  const expected = item.meta?.contentSha256 ?? null;
  if (!expected) return { status: "unverifiable", computed, expected: null };
  return { status: expected === computed ? "verified" : "mismatch", computed, expected };
}

import { createHash } from "node:crypto";

/**
 * Canonical content digest for a component release. This MUST stay byte-for-byte
 * identical to the server implementation (apps/web/src/lib/digest.ts) so the CLI
 * can verify that the files it received match the digest that was published.
 *
 * SHA-256 over the sorted (path, content) pairs. The sort is a deterministic
 * codepoint comparison (not locale-aware); line endings are normalized to \n;
 * length-prefixes prevent ambiguity between path and content boundaries.
 */
export interface DigestFile {
  path: string;
  content: string;
}

const normalize = (content: string): string => content.replace(/\r\n/g, "\n");

export function contentDigest(files: DigestFile[]): string {
  const parts = [...files]
    .map((file) => ({ path: file.path.trim(), content: normalize(file.content) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((file) => `${file.path.length}:${file.path}\n${file.content.length}:${file.content}`);
  const encoded = Buffer.from(parts.join("\n\u0000\n"), "utf8");
  return createHash("sha256").update(encoded).digest("hex");
}

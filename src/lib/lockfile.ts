/**
 * modulora.lock — the local install ledger. Records exactly what each `add`
 * wrote: the release version, its published content digest, and a SHA-256
 * per written file. `verify` uses it to detect local modifications; `diff`
 * and `update` use it to compare against upstream without ever guessing.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface LockedFile {
  /** Path relative to the project root (as written). */
  path: string;
  sha256: string;
}

export interface LockedComponent {
  version: string;
  /** Published content digest at install time (null = was unverifiable). */
  digest: string | null;
  registry: string;
  installedAt: string;
  files: LockedFile[];
}

export interface Lockfile {
  version: 1;
  components: Record<string, LockedComponent>;
}

const LOCKFILE = "modulora.lock";

export function fileHash(content: string): string {
  return createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
}

export function readLockfile(cwd: string): Lockfile {
  const path = join(cwd, LOCKFILE);
  if (!existsSync(path)) return { version: 1, components: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Lockfile;
    if (parsed.version !== 1 || typeof parsed.components !== "object") throw new Error("bad shape");
    return parsed;
  } catch {
    // A corrupt lockfile must not brick installs; start fresh but do not
    // silently delete — the write below preserves what we can.
    return { version: 1, components: {} };
  }
}

export function writeLockfile(cwd: string, lock: Lockfile): void {
  const sorted: Lockfile = {
    version: 1,
    components: Object.fromEntries(Object.entries(lock.components).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  writeFileSync(join(cwd, LOCKFILE), JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

export function recordInstall(
  cwd: string,
  /** Bare ref without version (@user/name) — one installed release per component. */
  bareRef: string,
  entry: {
    version: string;
    digest: string | null;
    registry: string;
    /** Either the written content (hashed here) or a precomputed hash — the
     *  latter lets `update` preserve the OLD hash for locally-edited files,
     *  so `verify` keeps flagging them instead of pretending they're clean. */
    files: { displayPath: string; content?: string; sha256?: string }[];
  },
): void {
  const lock = readLockfile(cwd);
  lock.components[bareRef] = {
    version: entry.version,
    digest: entry.digest,
    registry: entry.registry,
    installedAt: new Date().toISOString(),
    files: entry.files.map((f) => ({ path: f.displayPath, sha256: f.sha256 ?? fileHash(f.content ?? "") })),
  };
  writeLockfile(cwd, lock);
}

export type LocalFileState = "intact" | "modified" | "missing";

export function localFileState(cwd: string, file: LockedFile): LocalFileState {
  const abs = join(cwd, file.path);
  if (!existsSync(abs)) return "missing";
  return fileHash(readFileSync(abs, "utf8")) === file.sha256 ? "intact" : "modified";
}

import { existsSync } from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { CliError } from "./output.js";

/**
 * Resolve where a registry file lands in the consumer's project.
 *
 * Registry paths are shadcn-style (e.g. `components/ui/button.tsx`). If the
 * project keeps source under `src/`, we place files there; otherwise at the
 * project root. The resolved path is always shown in the plan so the write is
 * reviewable, and we refuse any path that escapes the project root.
 */
export interface ResolvedTarget {
  /** Path as declared in the registry item. */
  registryPath: string;
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to cwd, for display. */
  displayPath: string;
  exists: boolean;
}

export function resolveTargets(files: { path: string }[], cwd: string): ResolvedTarget[] {
  const useSrc = existsSync(join(cwd, "src"));
  return files.map((file) => {
    const rel = file.path.replace(/^\/+/, "");
    const withBase = useSrc ? join("src", rel) : rel;
    const absPath = resolve(cwd, withBase);
    const root = resolve(cwd) + sep;
    if (!absPath.startsWith(root) && absPath !== resolve(cwd)) {
      throw new CliError(`Refusing to write outside the project: ${file.path}`);
    }
    if (isAbsolute(rel) || normalize(rel).startsWith("..")) {
      throw new CliError(`Refusing unsafe path: ${file.path}`);
    }
    return {
      registryPath: file.path,
      absPath,
      displayPath: withBase,
      exists: existsSync(absPath),
    };
  });
}

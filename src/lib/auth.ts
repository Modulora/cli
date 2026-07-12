import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { registryUrl } from "../config.js";

/**
 * CLI credential storage. The token is a revocable Better Auth session token
 * granted through the device flow. Stored per registry origin at
 * ~/.config/modulora/auth.json with 0600 permissions. MODULORA_TOKEN overrides
 * (for CI). Tokens never appear in argv, logs, or lockfiles.
 */

const authDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "modulora");
const authFile = join(authDir, "auth.json");

type AuthStore = Record<string, { token: string }>;

function readStore(): AuthStore {
  try {
    if (!existsSync(authFile)) return {};
    return JSON.parse(readFileSync(authFile, "utf8")) as AuthStore;
  } catch {
    return {};
  }
}

export function getToken(): string | null {
  const env = process.env.MODULORA_TOKEN?.trim();
  if (env) return env;
  return readStore()[registryUrl()]?.token ?? null;
}

export function saveToken(token: string): void {
  const store = readStore();
  store[registryUrl()] = { token };
  mkdirSync(authDir, { recursive: true });
  writeFileSync(authFile, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
  chmodSync(authFile, 0o600);
}

export function clearToken(): boolean {
  const store = readStore();
  if (!store[registryUrl()]) return false;
  delete store[registryUrl()];
  if (Object.keys(store).length === 0) rmSync(authFile, { force: true });
  else writeFileSync(authFile, JSON.stringify(store, null, 2) + "\n", { mode: 0o600 });
  return true;
}

/** Authorization header for authenticated registry requests, if signed in. */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Resolve the signed-in user via the session endpoint. */
export async function fetchSession(): Promise<{ name: string | null; email: string; username: string | null } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${registryUrl()}/api/auth/get-session`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: { name?: string; email: string; username?: string } } | null;
  if (!data?.user) return null;
  return { name: data.user.name ?? null, email: data.user.email, username: data.user.username ?? null };
}

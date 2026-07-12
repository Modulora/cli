import { registryUrl } from "../config.js";
import { authHeaders, getToken } from "./auth.js";
import { CliError } from "./output.js";

export interface RegistryFile {
  path: string;
  content: string;
  type?: string;
}

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  files: RegistryFile[];
  /** Non-standard Modulora field: the published content digest for verification. */
  meta?: { contentSha256: string | null; version: string };
}

/** Parse `@user/name` or `@user/name@version` — validates the shape only. */
export function parseRef(ref: string): { namespace: string; name: string; version?: string } {
  const m = ref.match(/^@([a-z0-9-]+)\/([a-z0-9-]+)(?:@([0-9][\w.-]*))?$/i);
  if (!m) {
    throw new CliError(
      `"${ref}" is not a valid component reference. Expected @user/name or @user/name@version.`,
    );
  }
  return { namespace: m[1]!, name: m[2]!, version: m[3] };
}

export async function fetchRegistryItem(ref: string): Promise<RegistryItem> {
  parseRef(ref); // validate before hitting the network
  const url = `${registryUrl()}/r/${ref}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json", ...authHeaders() } });
  } catch (err) {
    throw new CliError(`Could not reach the registry at ${registryUrl()} (${(err as Error).message}).`);
  }
  if (res.status === 402) {
    const body = (await res.json().catch(() => ({}))) as { purchase_url?: string; price?: number; currency?: string };
    const price = body.price ? ` ($${(body.price / 100).toFixed(2)})` : "";
    const hint = getToken()
      ? "You haven't purchased it on this account."
      : "If you've purchased it, run `modulora login` first.";
    throw new CliError(
      `${ref} is a paid component${price}. ${hint}\n  Buy it at: ${body.purchase_url ?? `${registryUrl()}/components/${ref}`}`,
    );
  }
  if (res.status === 404) {
    throw new CliError(
      `${ref} was not found. It may be private, unlisted, or not yet approved for public install.`,
    );
  }
  if (!res.ok) {
    throw new CliError(`Registry returned ${res.status} for ${ref}.`);
  }
  const item = (await res.json()) as RegistryItem;
  if (!item || !Array.isArray(item.files)) {
    throw new CliError(`Registry returned an unexpected payload for ${ref}.`);
  }
  return item;
}

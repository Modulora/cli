/** Registry origin. Defaults to production; override for dev/self-hosting. */
export function registryUrl(): string {
  const raw = process.env.MODULORA_REGISTRY_URL?.trim();
  return (raw && raw.replace(/\/+$/, "")) || "https://modulora.dev";
}

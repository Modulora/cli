import { spawn } from "node:child_process";
import { platform } from "node:os";
import { defineCommand } from "citty";
import { registryUrl } from "../config.js";
import { clearToken, fetchSession, saveToken } from "../lib/auth.js";
import { guard } from "../lib/run.js";
import { CliError, log, pc } from "../lib/output.js";

const CLIENT_ID = "modulora-cli";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

export const loginCommand = defineCommand({
  meta: { name: "login", description: "Sign in to Modulora (device flow: approve in your browser)." },
  async run() {
    await guard(async () => {
      const base = registryUrl();

      // 1. Request a device code.
      const codeRes = await fetch(`${base}/api/auth/device/code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: CLIENT_ID }),
      });
      if (!codeRes.ok) throw new CliError(`Could not start login (registry returned ${codeRes.status}).`);
      const code = (await codeRes.json()) as DeviceCodeResponse;

      // 2. Show the code and open the approval page.
      const url = code.verification_uri_complete ?? code.verification_uri;
      log.info("");
      log.info(`  Confirm this code in your browser: ${pc.bold(code.user_code)}`);
      log.info(pc.dim(`  ${url}`));
      log.info("");
      openBrowser(url);

      // 3. Poll for the grant.
      let intervalMs = (code.interval ?? 5) * 1000;
      const deadline = Date.now() + code.expires_in * 1000;
      log.step("Waiting for approval…");
      while (Date.now() < deadline) {
        await sleep(intervalMs);
        const tokenRes = await fetch(`${base}/api/auth/device/token`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            device_code: code.device_code,
            client_id: CLIENT_ID,
          }),
        });
        const data = (await tokenRes.json()) as { access_token?: string; error?: string };
        if (data.access_token) {
          saveToken(data.access_token);
          const who = await fetchSession();
          log.ok(`Signed in${who ? ` as ${pc.bold(who.username ? `@${who.username}` : who.email)}` : ""}.`);
          return;
        }
        if (data.error === "authorization_pending") continue;
        if (data.error === "slow_down") { intervalMs += 2000; continue; }
        if (data.error === "access_denied") throw new CliError("Login was denied in the browser.", 130);
        if (data.error === "expired_token") break;
        if (data.error) throw new CliError(`Login failed: ${data.error}`);
      }
      throw new CliError("The code expired before it was approved. Run `modulora login` again.");
    });
  },
});

export const whoamiCommand = defineCommand({
  meta: { name: "whoami", description: "Show the signed-in account." },
  async run() {
    await guard(async () => {
      const who = await fetchSession();
      if (!who) throw new CliError("Not signed in. Run `modulora login`.");
      log.info(`${pc.bold(who.username ? `@${who.username}` : who.email)}${who.name ? pc.dim(`  (${who.name})`) : ""}`);
    });
  },
});

export const logoutCommand = defineCommand({
  meta: { name: "logout", description: "Sign out and remove the stored token." },
  async run() {
    await guard(async () => {
      // Best effort: revoke the session server-side before deleting locally.
      try {
        const { authHeaders } = await import("../lib/auth.js");
        await fetch(`${registryUrl()}/api/auth/sign-out`, { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: "{}" });
      } catch { /* offline logout is fine */ }
      log.info(clearToken() ? "Signed out." : "You weren't signed in.");
    });
  },
});

function openBrowser(url: string): void {
  const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch { /* user can open the printed URL */ }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

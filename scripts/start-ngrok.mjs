/**
 * Start ngrok → http://localhost:3000 using NGROK_AUTHTOKEN from .env
 *
 *   npm run ngrok
 *
 * Free account token: https://dashboard.ngrok.com/get-started/your-authtoken
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

loadEnv();

const token = process.env.NGROK_AUTHTOKEN?.trim();
if (!token) {
  console.error(`
Missing NGROK_AUTHTOKEN in .env

1. Open https://dashboard.ngrok.com/get-started/your-authtoken
2. Copy the token
3. Add to .env:
   NGROK_AUTHTOKEN=your_token_here
4. Run: npm run ngrok
`);
  process.exit(1);
}

const configDir = join(
  process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
  "ngrok",
);
mkdirSync(configDir, { recursive: true });
const configPath = join(configDir, "ngrok.yml");
writeFileSync(
  configPath,
  `version: "3"\nagent:\n  authtoken: ${token}\n`,
  "utf8",
);

const candidates = [
  join(process.env.APPDATA || "", "npm", "node_modules", "ngrok", "bin", "ngrok.exe"),
  join(process.env.APPDATA || "", "npm", "node_modules", "ngrok", "bin", "ngrok"),
  "ngrok",
];
const bin = candidates.find((p) => p === "ngrok" || existsSync(p)) || "ngrok";

console.log("Starting ngrok http 3000 …");
console.log("Web UI: http://127.0.0.1:4040");
console.log("Razorpay webhook will be: https://<host>/api/webhooks/razorpay");
console.log("(Copy the Forwarding HTTPS URL from the ngrok window or :4040)\n");

const child = spawn(bin, ["http", "3000", `--config=${configPath}`], {
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 1));

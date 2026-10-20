import fs from "node:fs";
import crypto from "node:crypto";

// Run only in the isolated test job. Production's database and receiving wallets are never read.
for (const key of ["WALLET_TEST_DATABASE_URL", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
  if (!process.env[key]) throw new Error(`Missing ${key} for the test deployment`);
}
const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/subdomain`, {
  headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
});
const response = await res.json();
if (!res.ok || !response.success || !/^[a-z0-9-]+$/.test(response.result?.subdomain)) throw new Error("Could not read the test deployment's workers.dev subdomain");
const appUrl = `https://furlong-wallet-test.${response.result.subdomain}.workers.dev`;
const databaseUrl = process.env.WALLET_TEST_DATABASE_URL;
console.log(`::add-mask::${databaseUrl}`);
fs.appendFileSync(process.env.GITHUB_ENV, `DATABASE_URL=${databaseUrl}\nAPP_URL=${appUrl}\n`);
const secretsPath = `${process.env.RUNNER_TEMP}/wallet-test-secrets.json`;
fs.writeFileSync(secretsPath, JSON.stringify({
  DATABASE_URL: databaseUrl, AUTH_SECRET: crypto.randomBytes(48).toString("base64url"),
  CRON_SECRET: crypto.randomBytes(48).toString("base64url"),
}), { mode: 0o600 });
const config = JSON.parse(fs.readFileSync("wrangler.test.jsonc", "utf8"));
config.vars.APP_URL = appUrl;
fs.writeFileSync("wrangler.test.generated.json", JSON.stringify(config, null, 2));
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Wallet test site\n\nURL: ${appUrl}\n\nSimulated funds only. Sign in with the separately provided test accounts.\n`);
console.log(`Test URL: ${appUrl}`);

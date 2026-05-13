#!/usr/bin/env node
// Generates an ES256 JWKS keypair at supabase/signing_keys.json so the local
// GoTrue can sign JWTs asymmetrically. The public half is exposed at
// /auth/v1/.well-known/jwks.json and consumed by khaos-id (and any sibling)
// to verify federated JWTs.
//
// Run once per clone — the file is gitignored. Idempotent unless --force is passed.

import { writeFile, mkdir, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(__dirname, "..", "supabase", "signing_keys.json");
const force = process.argv.includes("--force");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if ((await exists(outFile)) && !force) {
  console.log(`signing_keys.json already exists at ${outFile} — skipping. Pass --force to overwrite.`);
  process.exit(0);
}

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = await exportJWK(privateKey);
jwk.kid = randomUUID();
jwk.alg = "ES256";
jwk.use = "sig";

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify([jwk], null, 2) + "\n", "utf8");

console.log(`Wrote ES256 signing key (kid=${jwk.kid}) to ${outFile}`);

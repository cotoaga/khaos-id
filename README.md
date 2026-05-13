# khaos-id

Federated identity for the KHAOS ecosystem. Email + password auth on top of a local Supabase Auth, with JWTs verifiable by any sibling (Mouseion, DAGGER, Pluto, …) against the same JWKS endpoint.

This repo is the proof-of-shape for **Architecture B** — see `docs/architecture.md` and `docs/adr/0001-federated-jwt-supabase.md`.

Production: <https://khaos-id.vercel.app> (eventually `https://id.cotoaga.ai`). Hosted on Vercel with a Supabase Cloud substrate — see `docs/deployment.md` and `docs/adr/0003-hosted-supabase-substrate.md`.

## Local development

### Prerequisites

- Node.js 22+
- npm 10+
- Supabase CLI ≥ 2.51 (`brew install supabase/tap/supabase`)
- A container runtime for `supabase start` — **Docker Desktop** or **OrbStack** on macOS. None? `supabase start` will not run; everything else (lint/typecheck/test/build, code review) does.

### One-time setup

```bash
npm install
cp .env.local.example .env.local
npm run supabase:keys       # generates supabase/signing_keys.json (gitignored)
supabase start              # boots local Postgres + Auth + APIs; prints anon/service keys
```

`supabase start` outputs the local `anon` and `service_role` keys. The defaults shipped in `.env.local.example` match a fresh local Supabase, so for most clones you do not need to edit `.env.local` — but if your CLI mints different keys, paste them in.

### Run

```bash
npm run dev
```

App at <http://localhost:3000>. Studio at <http://127.0.0.1:54323>.

### Verification gate

Run before every push (this is the project's contract):

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

### Manual smoke test

1. Visit `http://localhost:3000` → click **Create an account** → submit `you@example.com` / `secret-123`.
2. You land on `/account`, which shows your JWT claims (`sub`, `email`, `aud`, `iss`, `exp`, `iat`, `role`) and a green "Signature verified" line proving the access token validates against the local JWKS endpoint.
3. DevTools → Application → Cookies → confirm `sb-*-auth-token` is `HttpOnly`.
4. Click **Sign out** on `/account` (or POST `/logout`) → cookie clears → `/account` redirects to `/login`.

## How JWT verification works here

- `supabase/config.toml` sets `signing_keys_path = "./signing_keys.json"`, switching the local GoTrue to asymmetric **ES256** signing.
- `npm run supabase:keys` generates that file using `jose`'s `generateKeyPair("ES256")`. The file is gitignored — each clone gets its own keypair.
- Once running, the public half is exposed at `http://127.0.0.1:54321/auth/v1/.well-known/jwks.json`.
- `lib/jwt.ts` uses `jose.createRemoteJWKSet` to fetch and cache that key, then `jwtVerify` to confirm the token's signature and `aud`. `/account` runs this verifier server-side on every render.

For sibling apps that want to do the same: see `docs/sibling-integration.md` — a 10–20 line `jose` snippet that drops into any Next.js (or plain Node) project.

## Project layout

```
app/
  (auth)/actions.ts     server actions: signup, login, logout
  account/page.tsx      authenticated; shows JWT claims + verification
  login/page.tsx        sign-in form
  signup/page.tsx       sign-up form
  logout/route.ts       POST → sign out → redirect /
  page.tsx              landing
lib/
  jwt.ts                JWKS-based access-token verifier
  supabase/
    client.ts           browser client
    server.ts           server client (cookies)
    admin.ts            service-role client
middleware.ts           cookie-session refresh + /account auth gate
scripts/
  generate-signing-keys.mjs
supabase/
  config.toml           local config (asymmetric signing enabled)
docs/
  architecture.md
  deployment.md
  sibling-integration.md
  adr/0001-federated-jwt-supabase.md
  adr/0003-hosted-supabase-substrate.md
```

## What's deliberately out of scope

Password reset, email verification, MFA, passkeys, OAuth, admin views, custom-domain cookie scope. Each gets its own issue.

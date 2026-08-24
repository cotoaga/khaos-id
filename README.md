# khaos-id

Federated identity for the KHAOS ecosystem. Email + password auth on top of a local Supabase Auth, with JWTs verifiable by any sibling (Mouseion, DAGGER, Pluto, …) against the same JWKS endpoint.

This repo is the proof-of-shape for **Architecture B** — see `docs/architecture.md` and `docs/adr/0001-federated-jwt-supabase.md`.

Production: <https://id.cotoaga.ai> (Vercel deployment, also reachable at `khaos-id.vercel.app`). Hosted on Vercel with a Supabase Cloud substrate — see `docs/deployment.md` and `docs/adr/0003-hosted-supabase-substrate.md`.

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

1. Public self-signup is retired — create a test account via Supabase Studio (`http://127.0.0.1:54323` → Authentication → Users → Add user) or the admin API.
2. Visit `http://localhost:3000` → click **Sign in** → log in with that account.
3. You land on `/account`, which shows your JWT claims (`sub`, `email`, `aud`, `iss`, `exp`, `iat`, `role`, `tier`) and a green "Signature verified" line proving the access token validates against the local JWKS endpoint.
4. DevTools → Application → Cookies → confirm `sb-*-auth-token` is `HttpOnly`.
5. Click **Sign out** on `/account` (or POST `/logout`) → cookie clears → `/account` redirects to `/login`. `GET /logout` returns 405.

## How JWT verification works here

- `supabase/config.toml` sets `signing_keys_path = "./signing_keys.json"`, switching the local GoTrue to asymmetric **ES256** signing.
- `npm run supabase:keys` generates that file using `jose`'s `generateKeyPair("ES256")`. The file is gitignored — each clone gets its own keypair.
- Once running, the public half is exposed at `http://127.0.0.1:54321/auth/v1/.well-known/jwks.json`.
- `lib/jwt.ts` uses `jose.createRemoteJWKSet` to fetch and cache that key, then `jwtVerify` to confirm the token's signature and `aud`. `/account` runs this verifier server-side on every render.

For sibling apps that want to do the same: see `docs/sibling-integration.md` — a 10–20 line `jose` snippet that drops into any Next.js (or plain Node) project.

## Project layout

```
app/
  (auth)/actions.ts     server actions: login, logout
  account/page.tsx      authenticated; shows JWT claims + verification
  login/page.tsx        sign-in form
  request/page.tsx      access-request placeholder (public signup is retired)
  logout/route.ts       POST → sign out → redirect / (GET is 405)
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

Email verification, MFA, passkeys, OAuth, admin views. Each gets its own issue. Public self-signup is retired by design (COT-150) — accounts are born only via invite or an approved request (COT-151).

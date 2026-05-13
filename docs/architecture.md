# Architecture B — Federated JWT

## Picture

```
   ┌─────────────────────────┐         ┌─────────────────────────┐
   │       Browser           │  cookie │       khaos-id (Next)   │
   │   (httpOnly JWT)        │ ──────▶ │  signup / login / acct  │
   └─────────────────────────┘         │   verifies JWT via JWKS │
                                       └────────────┬────────────┘
                                                    │
                                                    │ JWKS (public key)
                                                    ▼
                                       ┌─────────────────────────┐
                                       │ Supabase Auth (GoTrue)  │
                                       │ owns auth.users         │
                                       │ signs JWT with ES256    │
                                       └────────────┬────────────┘
                                                    │
                                                    │ JWKS (same public key)
                ┌───────────────────────────────────┼───────────────────────────────────┐
                ▼                                   ▼                                   ▼
  ┌─────────────────────────┐         ┌─────────────────────────┐         ┌─────────────────────────┐
  │  Mouseion               │         │  DAGGER                 │         │  Pluto                  │
  │  verifies same JWT      │         │  verifies same JWT      │         │  verifies same JWT      │
  │  joins data by `sub`    │         │  joins data by `sub`    │         │  joins data by `sub`    │
  └─────────────────────────┘         └─────────────────────────┘         └─────────────────────────┘
```

## Rules

1. **One identity store.** Supabase Auth (`auth.users`) is the only place a user exists. No sibling has a local users / profiles / accounts table.
2. **`sub` is the join key.** Per-sibling tables that need to be scoped to a user reference `auth.users(id)` (via Supabase's foreign keys) or — for siblings that share the same database — by `sub` (UUID) directly.
3. **JWT in httpOnly cookie.** The browser holds the access token only via `@supabase/ssr`. JS never reads it; it never lands in `localStorage`.
4. **Verification at the seam.** Any sibling that consumes the token verifies it against the same JWKS endpoint that minted it. Public-key trust only. No shared symmetric secret crosses repo boundaries.
5. **No service-role keys in the browser.** Service role is server-only, and only inside trusted backend code that needs RLS bypass.

## Why this shape

- **Decoupled deploys.** A sibling can ship without coordinating a schema change in khaos-id. They share an *identity*, not a database.
- **No drift.** There is one source of truth for "is this user real and unbanned" — Supabase Auth. Each sibling can't accidentally grow its own duplicate user record that goes stale.
- **Cheap onboarding for new siblings.** ~10–20 lines of `jose` + an env var. See `docs/sibling-integration.md`.

## Components in this repo

| File | Role |
|---|---|
| `lib/supabase/server.ts` | SSR-aware Supabase client for server components & actions; reads cookies. |
| `lib/supabase/client.ts` | Browser Supabase client; used only if/when we add client-rendered flows. |
| `lib/supabase/admin.ts` | Service-role client; reserved for trusted backend paths only. |
| `lib/jwt.ts` | JWKS-based access-token verifier. The thing siblings copy. |
| `middleware.ts` | Refreshes the cookie session on every request; gates `/account`. |
| `app/(auth)/actions.ts` | `signupAction`, `loginAction`, `logoutAction` — server actions. |
| `app/account/page.tsx` | Authenticated surface; renders verified claims. |

## Local JWT signing

- `supabase/config.toml`: `signing_keys_path = "./signing_keys.json"` switches GoTrue to asymmetric.
- `npm run supabase:keys`: writes an ES256 private JWK to `supabase/signing_keys.json` (gitignored).
- Public half is exposed at `http://127.0.0.1:54321/auth/v1/.well-known/jwks.json` once `supabase start` is running.

When this repo gets a production deployment (separate issue), GoTrue's JWKS endpoint will be at `https://auth.<domain>/auth/v1/.well-known/jwks.json` and every sibling will point its `SUPABASE_JWKS_URL` at that URL. Nothing about the verification code changes — that's the point of the federation.

## What is *not* in this repo (and never should be)

- A `users`, `profiles`, or `accounts` table.
- Any duplication of identity attributes that the JWT already carries (email, role, etc.).
- A way for the browser to call admin / service-role APIs.
- "Convenience" wrappers around the JWT verifier that hide the JWKS lookup — the lookup is the point.

## Related

- `docs/adr/0001-federated-jwt-supabase.md` — the decision record behind this shape.
- `docs/sibling-integration.md` — the minimal snippet siblings paste in.

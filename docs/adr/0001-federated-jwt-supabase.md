# ADR 0001 — Federated JWT via Supabase Auth (Architecture B)

**Status:** Accepted
**Date:** 2026-05-13
**Decision owner:** Kurt (KHAOS)

## Context

The KHAOS ecosystem is several semi-independent apps (Mouseion, DAGGER, Pluto, …) that need to share a single identity surface. Each app needs to know "is this request authenticated, and as whom?" without each app maintaining its own users table and without all apps needing to coordinate deploys to add an auth feature.

Two shapes were considered:

- **Architecture A — Shared central API.** Each sibling calls back to khaos-id over the network on every request to introspect the session. Coupled, latency-sensitive, and requires a custom session protocol.
- **Architecture B — Federated JWT.** khaos-id mints a signed JWT into an httpOnly cookie. Each sibling verifies the JWT locally against the same JWKS endpoint. No shared database for identity. No runtime coupling beyond the public key.

## Decision

Adopt **Architecture B**.

- Identity lives in **Supabase Auth** (`auth.users`). No KHAOS sibling has a local users table.
- Access tokens are signed **asymmetrically (ES256)**. Locally that's enabled in `supabase/config.toml` via `signing_keys_path`. In production it will be Supabase's managed signing-key feature.
- Tokens live in **httpOnly cookies**, set by `@supabase/ssr`. The browser never reads them.
- Every sibling verifies tokens against `<supabase-auth>/auth/v1/.well-known/jwks.json` using `jose` (or any spec-compliant JOSE library). Trust is public-key only.
- Per-user data inside any sibling joins to the JWT's `sub` claim (Supabase user UUID).

## Consequences

**Good**

- Siblings deploy independently. Adding a sibling is ~20 lines + an env var (see `docs/sibling-integration.md`).
- No shared symmetric secret crossing repo boundaries.
- Key rotation is a Supabase-side operation; siblings inherit it via JWKS automatically.
- Stateless verification — no per-request round-trip to khaos-id.

**Trade-offs**

- Logout is "best effort" until the access token expires. Siblings can opt into checking with khaos-id for hard-revocation, but the default is "trust the signed token until `exp`". Mitigated by short token lifetimes (default 1h).
- Schema changes to "what a user is" are Supabase-side; siblings can't add columns to `auth.users`. Per-sibling attributes live in per-sibling tables keyed by `sub`.
- All siblings must agree on `aud = "authenticated"` (Supabase's default) or on whatever audience policy we settle on. That's a coordination point, but a small one.

## Out of scope for this ADR

- Choice of identity provider (assumed: Supabase Auth).
- Production deployment topology and custom domain for cookie scope.
- Hard-revocation / blocklist strategy.
- MFA, passkeys, social providers.

These each get their own ADRs when needed.

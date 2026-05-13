# ADR 0003 — Start on hosted Supabase, not self-hosted Hetzner

**Status:** Accepted
**Date:** 2026-05-13
**Decision owner:** Kurt (KHAOS)

## Context

khaos-id needs a production identity substrate (Postgres + GoTrue + JWKS) so the federated-JWT seam from [ADR-0001](./0001-federated-jwt-supabase.md) actually works for siblings. Two substrates were on the table:

- **Supabase Cloud** (managed). One-click project, signing keys handled, automatic upgrades, dashboard for URL config and user inspection. EU regions available. Pay-per-project past the free tier.
- **Self-hosted Hetzner.** Docker-Compose'd Supabase on a single VM (or k3s). Full sovereignty over storage and keys, EU-jurisdiction-only by construction, no per-project Supabase pricing. All the ops work is mine.

The KHAOS preference long-term is sovereign infrastructure — Hetzner is already the substrate plan of record for siblings that need to own their data. But khaos-id is the *first* sibling out the gate and is still proving the shape (Architecture B). Burning a week on self-host plumbing before the seam is proven would be premature.

## Decision

**Start on Supabase Cloud.** Specifically:

- Project: `khaos-id` (`uwgykeijsejiitwmvzrl`)
- Region: `eu-west-1` (Ireland — closest hosted EU option; legal in scope for an EU-only product surface)
- Asymmetric signing keys: enabled in the Supabase dashboard, matching the local `signing_keys.json` shape used in `supabase/config.toml`
- JWKS endpoint exposed at `https://uwgykeijsejiitwmvzrl.supabase.co/auth/v1/.well-known/jwks.json` — siblings point `SUPABASE_JWKS_URL` here

This is explicitly a **substrate choice**, not an architecture choice. ADR-0001 (federated JWT, JWKS at the seam) does not change. The verifier in `lib/jwt.ts` is substrate-agnostic — it talks to whatever URL `SUPABASE_JWKS_URL` resolves to.

## Why hosted first

- **Time-to-seam.** Proof-of-shape required a public JWKS endpoint that real siblings can hit. Supabase Cloud delivered that in minutes vs days.
- **Reversible.** Migration from Supabase Cloud to self-hosted is well-trodden — `pg_dump` of `auth.*` plus `gotrue-cli` config + Supabase's own self-host guide. No proprietary lock-in beyond Postgres + GoTrue, which are both OSS.
- **Surface area parity.** Cloud GoTrue and self-hosted GoTrue speak the same protocol. Sibling code that verifies against a JWKS URL does not care which side the URL points at. The verifier survives the migration unchanged.
- **Cheap during exploration.** Free tier covers the proof-of-shape phase; we are not at the volume where managed pricing matters yet.

## Trade-offs accepted (for now)

- **Data sovereignty is partial.** Identity data lives in Supabase's infrastructure (AWS Ireland under the hood). Acceptable while the only user is me. **Not** acceptable once real siblings store user-linked data and the legal/regulatory surface grows — see triggers below.
- **Auth URL config splits.** Cloud project URL config lives in the Supabase dashboard, not in the repo. See [ADR-0002 (COT-47)](https://linear.app/cotoaganet/issue/COT-47) for the foot-gun this creates.
- **Key custody is partial.** Supabase holds the GoTrue signing private key. Public half is exposed via JWKS as designed; the trust model from ADR-0001 still holds. But hard custody of the private key sits with Supabase.
- **Single point of vendor failure.** A Supabase outage takes the seam down. Mitigated by short-token-lifetime stateless verification: existing sessions keep working at siblings until tokens expire (~1h).

## Migration triggers — when to revisit

Move to self-hosted Hetzner when **any one** of the following becomes true:

1. **Cost.** Supabase Cloud bill for this project exceeds ~€50/month sustained, or pricing changes make managed Postgres unattractive vs Hetzner-self-host at projected scale.
2. **Sovereignty.** Any sibling needs to store data subject to stricter EU / sector-specific data-residency rules than Supabase Cloud (Frankfurt-AWS) can attest to.
3. **Feature ceiling.** A feature we need (custom GoTrue extensions, Postgres extensions not on the managed allow-list, custom signing-key rotation policy) is not available on managed.
4. **Operational confidence.** The ops side of self-host is no longer scary — `docker compose up` parity exists in the KHAOS infra repo, restic backups proven, monitoring wired.

When a trigger fires, open a new issue ("Migrate khaos-id substrate to self-hosted Hetzner") and a new ADR. The migration itself is not in scope here.

## Out of scope for this ADR

- The specific Hetzner topology (k3s vs single-VM, backup cadence, region) — that's the migration ADR's job when it comes.
- Choice of identity provider — ADR-0001 already locked in Supabase Auth as the GoTrue implementation.
- Production observability — Pluto's job when Pluto exists.
- Per-sibling Supabase project layout — siblings consume the JWKS URL; substrate ownership stays here.

## Related

- [ADR-0001](./0001-federated-jwt-supabase.md) — Federated JWT shape (substrate-agnostic).
- [COT-47 / ADR-0002](https://linear.app/cotoaganet/issue/COT-47) — Auth URL config lives in two places.
- `docs/deployment.md` — How the cloud substrate is wired up to Vercel.

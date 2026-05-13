# Deployment — khaos-id

How the production proof-of-shape at <https://khaos-id.vercel.app> is wired. Captured retroactively for [COT-46](https://linear.app/cotoaganet/issue/COT-46) — the first deploy happened during exploration before a Linear issue existed; this file closes the calibration gap.

## Hosting

- **Frontend / SSR:** Vercel (team `Cotoaga-Dot-Net`, project `khaos-id`, framework `nextjs`, Node 24.x).
- **Identity substrate:** Supabase Cloud (hosted GoTrue + Postgres). See `docs/adr/0003-hosted-supabase-substrate.md` for the substrate decision.

## URLs

| Surface | URL |
|---|---|
| Primary production | <https://khaos-id.vercel.app> |
| Vercel-generated aliases | `khaos-id-cotoagadotnet.vercel.app`, `khaos-id-cotoaga-net-cotoagadotnet.vercel.app` |
| Future custom domain | `https://id.cotoaga.ai` (DNS cutover is a separate issue, out of scope here) |
| Supabase Auth (production) | `https://uwgykeijsejiitwmvzrl.supabase.co` |
| JWKS endpoint | `https://uwgykeijsejiitwmvzrl.supabase.co/auth/v1/.well-known/jwks.json` |

## Branch → environment mapping

Vercel defaults — no `vercel.ts` override.

| Branch | Vercel environment | URL |
|---|---|---|
| `main` | **Production** | `https://khaos-id.vercel.app` |
| any other branch / PR | **Preview** | `https://khaos-<hash>-cotoagadotnet.vercel.app` |
| local | **Development** | `http://localhost:3000` (uses local Supabase via `supabase start`) |

A push to `main` triggers a production deploy. Every other push triggers a preview deploy with the same env-var set (Preview shares the Production Supabase Cloud project for now — there is no separate Supabase Cloud project per Vercel environment).

## Environment variables

Configured under **Project Settings → Environment Variables** in Vercel for the `Production` and `Preview` environments. Values are not reproduced here — pull them with `vercel env pull` if you need them locally against the cloud substrate, or read the placeholders in `.env.local.example` for shape.

| Key | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Public Supabase project URL — `https://uwgykeijsejiitwmvzrl.supabase.co` in production. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Public anon key for the SSR client. Safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Server-only RLS-bypass key. Never exposed to the browser. |
| `SUPABASE_JWKS_URL` | Production, Preview | Where `lib/jwt.ts` fetches the public verification key — `https://uwgykeijsejiitwmvzrl.supabase.co/auth/v1/.well-known/jwks.json`. |
| `SUPABASE_JWT_AUDIENCE` | Production, Preview | Expected `aud` claim. `authenticated` (Supabase default). |

Locally, the same keys point at `http://127.0.0.1:54321` and the keys that `supabase start` mints. See `.env.local.example`.

### Sourcing values

```bash
vercel link                        # one-time per clone
vercel env pull .env.production    # writes the cloud values into a local file (gitignored)
```

Use `.env.production` only for one-off scripts against the cloud project. Day-to-day development runs against local Supabase via `.env.local`.

## Deploy procedure

The first deploy ran via the Vercel dashboard (GitHub import). Day-to-day:

1. Open a feature branch (`kurt/cot-<n>-<slug>`), commit work, open a PR against `main`.
2. Vercel automatically builds a Preview for the branch — verify there.
3. Merge to `main` → automatic Production deploy.

CLI alternatives (rarely needed):

```bash
vercel                 # deploy current branch as a Preview
vercel --prod          # deploy current branch as Production (skips the PR loop — use sparingly)
vercel deploy --prebuilt   # use a locally built artifact
```

Rollback: in Vercel dashboard → **Deployments** → pick a previous READY production deploy → **Promote to Production**.

## Pre-push verification gate

Identical to local — production has no separate gate. Every push must clear:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Supabase config that lives in two places

Auth URLs (site URL + redirect URLs) are configured in **two** locations and must stay aligned:

- **Local:** `supabase/config.toml` (`[auth] site_url`, `additional_redirect_urls`).
- **Cloud:** Supabase Dashboard → Authentication → URL Configuration for project `uwgykeijsejiitwmvzrl`.

This split is intentional (cloud config is dashboard-managed, not file-managed in this repo) but is a real foot-gun — captured in [COT-47 / ADR-0002](https://linear.app/cotoaganet/issue/COT-47).

## What is *not* documented here

- Custom-domain cutover for `id.cotoaga.ai` — separate issue.
- Observability / runtime logs piping — Pluto's job when Pluto exists.
- A managed migration path to self-hosted Hetzner — see `docs/adr/0003-hosted-supabase-substrate.md` for the trigger conditions; the migration itself gets its own issue when those triggers fire.

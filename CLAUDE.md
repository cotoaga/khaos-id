# khaos-id — Standing Tactical Calibration

**Mission.** Federated identity for the KHAOS ecosystem (Architecture B). One auth surface, many siblings; everyone trusts the same JWKS.

**Style.** Style Seed: **v2.1**. Brand: **cotoaga.ai**, dark theme default (deep-sky `#191A2E` page bg, dark-marine `#16213E` surfaces, `--cotoaga-green` CTAs, `--cotoaga-ai-sand` accent, `--cotoaga-cyan` hero/code). Sharp edges (`border-radius: 0`). Tokens declared in `app/globals.css`; fonts (Space Grotesk / Inter / JetBrains Mono) loaded via `next/font/google` in `app/layout.tsx`. The `MonadField` hero on `/` keeps its scoped Pythagorean register (Cormorant Garamond + gold-on-near-black) as a sovereign visual exception — do not blend with cotoaga.ai tokens. Reference: `../khaos-seeds/seed-style.md` v2.1, cotoaga.ai chapter.

**Linear.** Team `CotoagaDotNet`. Issues are source of truth. Pre-push summary as a Linear comment on the active issue before every push.

---

## Architecture B is sacred

- **No users table in this repo.** Identity lives in `auth.users` inside Supabase Auth. If you find yourself reaching for a local `users` / `profiles` / `accounts` table, stop. Per-repo data joins to `sub` (the Supabase user UUID) — that's the only fact crossing the seam.
- **JWT in httpOnly cookie**, never `localStorage`. Cookie handling is `@supabase/ssr` only; browser JS never sees raw service role keys.
- **Verification at the seam.** Every page/route that needs identity verifies the access token against the local JWKS endpoint (`/auth/v1/.well-known/jwks.json`). `lib/jwt.ts` is the reusable verifier — siblings copy or import this shape.

Background: `docs/architecture.md`, `docs/adr/0001-federated-jwt-supabase.md`. Read them before changing the auth seam.

## Stack

Next.js 15 App Router · TypeScript strict · Tailwind v4 · `@supabase/ssr` · `jose` for JWT verification · vitest · Local Supabase via CLI.

## Surgical Discipline

Every changed line traces to the active directive. No drive-by refactors. No comment massage. No "while I'm here" cleanup. If something unrelated needs fixing, open a Linear comment on the active issue — don't fix it in this commit.

## Orphan Rules

Remove only imports/symbols YOUR changes orphaned. Pre-existing dead code: flag in a Linear comment, never delete.

## Atomic Commits

Conventional format: `feat|fix|refactor|docs|chore(scope): description`. One concern per commit. No omnibus commits. Pre-push summary in Linear comment on the active issue.

## No Drive-By Abstractions

Do not extract until the second use case lands. No premature interfaces. No speculative generality. Three similar lines beats a premature abstraction.

## Test Discipline

Tests live with their feature. No zero-test green theater. The JWT helper and the auth actions both carry tests; that bar holds for every new auth-touching feature.

## Verification gate (before every push)

```
npm run lint && npm run typecheck && npm test && npm run build
```

All four must pass. If any fail → fix → re-run → green → commit. No exceptions.

## Out of scope for this repo (do not pull in)

- Password reset (next issue)
- Email verification (next issue)
- MFA, passkeys, OAuth providers
- Admin views (user list, role assignment)
- Sibling integrations (proven via the doc snippet only — don't bundle siblings here)
- Production deployment, custom domain, TLS

## Ecosystem Seeds

KHAOS ecosystem patterns live in `../khaos-seeds/`. Before reworking the Supabase surface, read `../khaos-seeds/seed-supabase.md` — this repo is Shape A (Next.js SSR Pattern).

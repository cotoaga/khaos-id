# Sibling Integration — Federated JWT in ~20 lines

Any KHAOS app (Mouseion, DAGGER, Pluto, …) that wants to consume a khaos-id session does so by **verifying the access token against the same JWKS endpoint that minted it**. No shared symmetric secret. No round-trip to khaos-id. Public-key trust only.

The shape below is the minimum a sibling needs. It is identical to what khaos-id itself uses in `lib/jwt.ts` (which is verified by tests under `lib/jwt.test.ts`).

---

## What the sibling needs

Two env vars:

```env
# Public Supabase URL (the same one khaos-id points at).
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321

# JWKS endpoint — derived from the URL above, but kept explicit so a sibling
# can repoint it at a federated/production URL later without code changes.
SUPABASE_JWKS_URL=http://127.0.0.1:54321/auth/v1/.well-known/jwks.json
```

One dependency:

```bash
npm install jose @supabase/ssr
```

---

## The snippet (TypeScript, drop into `lib/khaos-id.ts`)

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL!));

export async function getVerifiedClaims(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { payload } = await jwtVerify(session.access_token, JWKS, {
    audience: "authenticated",
  });
  return payload; // sub, email, aud, iss, exp, iat, role
}
```

That's it. ~17 lines of executable code. Use `getVerifiedClaims()` anywhere you'd reach for "who is this user" — Server Components, Server Actions, Route Handlers.

---

## Example: gate a Server Component

```ts
// app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getVerifiedClaims } from "@/lib/khaos-id";

export default async function Dashboard() {
  const claims = await getVerifiedClaims();
  if (!claims) redirect("http://localhost:3000/login"); // back to khaos-id
  return <p>Hello, {String(claims.email)} (sub: {String(claims.sub)})</p>;
}
```

The sibling joins its own data to `claims.sub`. It does not (and must not) create a local `users` table.

---

## Cookie scope in dev vs prod

- **Local dev:** `localhost` shares cookies across ports automatically. The sibling on `:3001` will see khaos-id's auth cookie at `:3000` only if it runs on the same Next.js dev server (or you use a reverse proxy). For multi-port local testing, browse khaos-id, sign in, then visit the sibling — most browsers scope `localhost` strictly. Production solves this via a shared parent domain (`.cotoaga.ai`); local dev usually uses a single Next app embedding the sibling for demo purposes.
- **Production (out of scope here):** cookie domain is set to `.cotoaga.ai`; the JWKS URL is `https://auth.cotoaga.ai/auth/v1/.well-known/jwks.json`. Everything else is the same.

---

## What this snippet does *not* do

- **No hard revocation.** If the user signs out in khaos-id, the sibling will still trust the token until `exp` (default 1 hour). If you need hard revocation, call back to khaos-id's `/account` (or a small `/api/session` endpoint) to check.
- **No write access to `auth.users`.** Sibling has read-only knowledge of identity. To change email/password, the user goes to khaos-id.
- **No local users table.** If you find yourself adding one, stop and re-read `docs/architecture.md`.

---

## Verifying the snippet works

The same verification primitive in `khaos-id` is exercised by tests at `lib/jwt.test.ts`. To convince yourself the snippet above is real:

```bash
# in the sibling project
node -e '
  import("jose").then(async ({ createRemoteJWKSet, jwtVerify }) => {
    const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL));
    // Paste an access token captured from khaos-id (DevTools → Application → Cookies, base64-decode if needed)
    const token = process.env.TOKEN;
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, { audience: "authenticated" });
    console.log("verified", { alg: protectedHeader.alg, kid: protectedHeader.kid, sub: payload.sub });
  });
'
```

Run with `SUPABASE_JWKS_URL=… TOKEN=… node -e …`. If the token validates, you're done — the federation works.

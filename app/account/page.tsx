import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { verifyAccessToken } from "@/lib/jwt";
import {
  resolveSessionLifetimePref,
  safeVerifySessionDeadline,
  SESSION_DEADLINE_COOKIE,
} from "@/lib/session-deadline";
import { SessionLifetimeControl } from "./SessionLifetimeControl";

interface ClaimRow {
  label: string;
  value: string;
}

const CORE_CLAIMS = ["sub", "email", "aud", "iss", "exp", "iat", "role", "tier"];

function formatClaim(key: string, value: unknown): string {
  if (value === undefined || value === null) return "—";
  if ((key === "exp" || key === "iat") && typeof value === "number") {
    return `${value} (${new Date(value * 1000).toISOString()})`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatRemaining(deadline: number): string {
  const remainingMs = deadline * 1000 - Date.now();
  if (remainingMs <= 0) return "expired";
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h ${minutes}m remaining`;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  let verificationStatus: "verified" | "failed" = "failed";
  let verificationError: string | null = null;
  let claims: Record<string, unknown> = {};
  let alg: string | null = null;
  let kid: string | null = null;

  try {
    const result = await verifyAccessToken(session.access_token);
    verificationStatus = "verified";
    claims = result.payload as Record<string, unknown>;
    alg = result.protectedHeader.alg;
    kid = result.protectedHeader.kid ?? null;
  } catch (e) {
    verificationError = e instanceof Error ? e.message : String(e);
  }

  const coreRows: ClaimRow[] = CORE_CLAIMS.map((key) => ({
    label: key,
    value: formatClaim(key, claims[key]),
  }));

  const extraRows: ClaimRow[] = Object.keys(claims)
    .filter((k) => !CORE_CLAIMS.includes(k))
    .sort()
    .map((key) => ({ label: key, value: formatClaim(key, claims[key]) }));

  const currentPref = resolveSessionLifetimePref(claims.user_metadata);
  const cookieStore = await cookies();
  const deadline = await safeVerifySessionDeadline(
    cookieStore.get(SESSION_DEADLINE_COOKIE)?.value,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Account
        </h1>
        <p className="text-sm text-text-secondary">
          Identity surface for federated JWT (Architecture B). Everything below
          comes from the access token the browser holds via httpOnly cookie.
        </p>
      </header>

      <section className="bg-bg-card border border-white/10 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          JWKS verification
        </h2>
        {verificationStatus === "verified" ? (
          <p className="mt-2 text-sm">
            <span className="font-medium text-success">Signature verified</span>{" "}
            against{" "}
            <code className="font-mono text-xs text-code">
              {process.env.SUPABASE_JWKS_URL}
            </code>
            {alg ? (
              <>
                {" "}
                · alg{" "}
                <code className="font-mono text-xs text-code">{alg}</code>
              </>
            ) : null}
            {kid ? (
              <>
                {" "}
                · kid{" "}
                <code className="font-mono text-xs text-code">{kid}</code>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-danger">
            Signature verification failed: {verificationError}
          </p>
        )}
      </section>

      <section className="bg-bg-card border border-white/10 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Core claims
        </h2>
        <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
          {coreRows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="font-mono text-text-secondary">{row.label}</dt>
              <dd className="break-all font-mono text-text-primary">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {extraRows.length > 0 ? (
        <section className="bg-bg-card border border-white/10 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Other claims
          </h2>
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
            {extraRows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="font-mono text-text-secondary">{row.label}</dt>
                <dd className="break-all font-mono text-text-primary">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="bg-bg-card border border-white/10 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Session lifetime
        </h2>
        <p className="mt-2 text-sm text-text-primary">
          {deadline
            ? formatRemaining(deadline.deadline)
            : "No enforced deadline on this session — sign in again to establish one."}
        </p>
        <div className="mt-3">
          <SessionLifetimeControl current={currentPref} />
        </div>
      </section>

      <div className="flex items-center justify-between pt-2">
        <form action="/logout" method="post">
          <button
            type="submit"
            className="border border-dormant px-3 py-2 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            Sign out
          </button>
        </form>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-link transition-opacity hover:opacity-70"
          >
            ↗ Monad field
          </Link>
          <a
            href="https://khaos-pluto.cotoaga.ai/"
            className="text-sm text-link transition-opacity hover:opacity-70"
          >
            ↗ KHAOS-Pluto
          </a>
        </div>
      </div>
    </main>
  );
}

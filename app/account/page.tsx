import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyAccessToken } from "@/lib/jwt";
import { SessionLifetimeControl } from "./SessionLifetimeControl";

interface ClaimRow {
  label: string;
  value: string;
}

const CORE_CLAIMS = ["sub", "email", "aud", "iss", "exp", "iat", "role"];

type SessionPref = "1h" | "1d" | "7d";

function formatClaim(key: string, value: unknown): string {
  if (value === undefined || value === null) return "—";
  if ((key === "exp" || key === "iat") && typeof value === "number") {
    return `${value} (${new Date(value * 1000).toISOString()})`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function resolveSessionPref(meta: unknown): SessionPref {
  const VALID: SessionPref[] = ["1h", "1d", "7d"];
  if (
    meta &&
    typeof meta === "object" &&
    "session_lifetime_pref" in meta &&
    VALID.includes((meta as Record<string, unknown>).session_lifetime_pref as SessionPref)
  ) {
    return (meta as Record<string, unknown>).session_lifetime_pref as SessionPref;
  }
  return "1h";
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

  const currentPref = resolveSessionPref(claims.user_metadata);

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
        <a
          href="https://khaos-pluto.cotoaga.ai/"
          className="text-sm text-link transition-opacity hover:opacity-70"
        >
          ↗ KHAOS-Pluto
        </a>
      </div>
    </main>
  );
}

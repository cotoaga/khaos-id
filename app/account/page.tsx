import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyAccessToken } from "@/lib/jwt";

interface ClaimRow {
  label: string;
  value: string;
}

const CORE_CLAIMS = ["sub", "email", "aud", "iss", "exp", "iat", "role"];

function formatClaim(key: string, value: unknown): string {
  if (value === undefined || value === null) return "—";
  if ((key === "exp" || key === "iat") && typeof value === "number") {
    return `${value} (${new Date(value * 1000).toISOString()})`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const surfaceCard =
  "border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.2)]";
const sectionLabel =
  "font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-text-secondary)]";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--brand-hero-color)]">
          Account
        </h1>
        <p className="text-sm text-[var(--brand-text-secondary)]">
          Identity surface for federated JWT (Architecture B). Everything below
          comes from the access token the browser holds via httpOnly cookie.
        </p>
      </header>

      <section className={surfaceCard}>
        <h2 className={sectionLabel}>JWKS verification</h2>
        {verificationStatus === "verified" ? (
          <p className="mt-3 text-sm">
            <span className="font-semibold text-[var(--cotoaga-green)]">
              Signature verified
            </span>{" "}
            against{" "}
            <code className="font-mono text-[var(--brand-code-text)]">
              {process.env.SUPABASE_JWKS_URL}
            </code>
            {alg ? (
              <>
                {" "}
                · alg{" "}
                <code className="font-mono text-[var(--brand-code-text)]">
                  {alg}
                </code>
              </>
            ) : null}
            {kid ? (
              <>
                {" "}
                · kid{" "}
                <code className="font-mono text-[var(--brand-code-text)]">
                  {kid}
                </code>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="mt-3 text-sm text-red-300">
            Signature verification failed: {verificationError}
          </p>
        )}
      </section>

      <section className={surfaceCard}>
        <h2 className={sectionLabel}>Core claims</h2>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          {coreRows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="font-mono text-[var(--brand-text-secondary)]">
                {row.label}
              </dt>
              <dd className="break-all font-mono text-[var(--brand-text-body)]">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {extraRows.length > 0 ? (
        <section className={surfaceCard}>
          <h2 className={sectionLabel}>Other claims</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            {extraRows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="font-mono text-[var(--brand-text-secondary)]">
                  {row.label}
                </dt>
                <dd className="break-all font-mono text-[var(--brand-text-body)]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <form action="/logout" method="post">
        <button
          type="submit"
          className="border border-[var(--brand-border)] bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-text-body)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

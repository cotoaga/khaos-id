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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-neutral-500">
          Identity surface for federated JWT (Architecture B). Everything below
          comes from the access token the browser holds via httpOnly cookie.
        </p>
      </header>

      <section className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          JWKS verification
        </h2>
        {verificationStatus === "verified" ? (
          <p className="mt-2 text-sm">
            <span className="font-medium text-green-700 dark:text-green-400">
              Signature verified
            </span>{" "}
            against <code>{process.env.SUPABASE_JWKS_URL}</code>
            {alg ? (
              <>
                {" "}
                · alg <code>{alg}</code>
              </>
            ) : null}
            {kid ? (
              <>
                {" "}
                · kid <code>{kid}</code>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">
            Signature verification failed: {verificationError}
          </p>
        )}
      </section>

      <section className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Core claims
        </h2>
        <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
          {coreRows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="font-mono text-neutral-500">{row.label}</dt>
              <dd className="break-all font-mono">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {extraRows.length > 0 ? (
        <section className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Other claims
          </h2>
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
            {extraRows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="font-mono text-neutral-500">{row.label}</dt>
                <dd className="break-all font-mono">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <form action="/logout" method="post">
        <button
          type="submit"
          className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

import { setCredentialsAction } from "@/app/activate/actions";
import { verifyActionToken, type ActionTokenPurpose } from "@/lib/action-token";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token) {
    return <InvalidLink message="Missing activation token." />;
  }

  let purpose: ActionTokenPurpose | null = null;
  for (const candidate of ["invite", "activate_visitor"] as const) {
    try {
      await verifyActionToken(token, candidate);
      purpose = candidate;
      break;
    } catch {
      // try the next candidate purpose
    }
  }

  if (!purpose) {
    return <InvalidLink message="This link is invalid or has expired." />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          {purpose === "invite" ? "Accept your invite" : "Set your password"}
        </h1>
        <p className="text-sm text-text-secondary">
          {purpose === "invite"
            ? "You're setting up a guest account."
            : "Your access request was approved — choose a password to finish."}
        </p>
      </header>

      <form action={setCredentialsAction} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="purpose" value={purpose} />
        {purpose === "invite" ? (
          <>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Name
              <input
                type="text"
                name="name"
                required
                autoComplete="given-name"
                className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Surname
              <input
                type="text"
                name="surname"
                required
                autoComplete="family-name"
                className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </label>
          </>
        ) : null}
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="bg-bg-card border border-white/10 px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        {error ? (
          <p
            role="alert"
            className="border border-danger bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="bg-cta px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-accent"
        >
          {purpose === "invite" ? "Create account" : "Activate account"}
        </button>
      </form>
    </main>
  );
}

function InvalidLink({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <p role="alert" className="border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
        {message}
      </p>
    </main>
  );
}

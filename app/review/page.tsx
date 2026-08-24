import { requireRootSession } from "@/lib/root-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyActionToken } from "@/lib/action-token";
import { approveRequestAction, declineRequestAction } from "@/app/review/actions";

const DONE_MESSAGES: Record<string, string> = {
  approved: "Request approved. An activation email is on its way.",
  declined: "Request declined and deleted.",
  alreadyhandled: "This request was already handled.",
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; done?: string }>;
}) {
  await requireRootSession("/review");
  const { token, error, done } = await searchParams;

  if (done) {
    return (
      <Shell>
        <Banner text={DONE_MESSAGES[done] ?? "Done."} />
      </Shell>
    );
  }

  if (!token) {
    return (
      <Shell>
        <Banner text="Missing review token." tone="danger" />
      </Shell>
    );
  }

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, "review_request"));
  } catch {
    return (
      <Shell>
        <Banner text="This review link is invalid or has expired." tone="danger" />
      </Shell>
    );
  }

  const admin = createAdminClient();
  const { data, error: lookupError } = await admin.auth.admin.getUserById(sub);
  if (lookupError || !data.user || data.user.app_metadata?.status !== "pending_review") {
    return (
      <Shell>
        <Banner text="This request has already been handled." />
      </Shell>
    );
  }

  const { email, user_metadata } = data.user;

  return (
    <Shell>
      <p className="text-sm text-text-primary">
        {user_metadata?.name} {user_metadata?.surname} &lt;{email}&gt;
      </p>
      {error ? <Banner text={error} tone="danger" /> : null}
      <div className="flex gap-3">
        <form action={approveRequestAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="bg-cta px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-accent"
          >
            Approve
          </button>
        </form>
        <form action={declineRequestAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="border border-danger px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            Decline
          </button>
        </form>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Review request
        </h1>
      </header>
      {children}
    </main>
  );
}

function Banner({ text, tone = "success" }: { text: string; tone?: "success" | "danger" }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={`border px-3 py-2 text-sm ${
        tone === "danger"
          ? "border-danger bg-danger/10 text-danger"
          : "border-success bg-success/10 text-success"
      }`}
    >
      {text}
    </p>
  );
}

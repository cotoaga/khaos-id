import Link from "next/link";
import { requireRootSession } from "@/lib/root-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteGuestAction,
  resendInviteAction,
  revokeInviteAction,
} from "@/app/invites/actions";

interface PendingInvite {
  id: string;
  email: string;
  invitedAt: string;
}

async function listPendingInvites(): Promise<PendingInvite[]> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? [])
    .filter((u) => u.app_metadata?.status === "pending_invite")
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      invitedAt: u.app_metadata?.invited_at ?? u.created_at,
    }));
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    invited?: string;
    resent?: string;
    revoked?: string;
  }>;
}) {
  await requireRootSession("/invites");
  const { error, invited, resent, revoked } = await searchParams;
  const pending = await listPendingInvites();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Guest invites
        </h1>
        <p className="text-sm text-text-secondary">
          Root-only. Invite a guest by email — they set their own name,
          surname, and password when they accept.
        </p>
      </header>

      {invited ? <Banner text="Invite sent." /> : null}
      {resent ? <Banner text="Invite resent." /> : null}
      {revoked ? <Banner text="Invite revoked." /> : null}
      {error ? <Banner text={error} tone="danger" /> : null}

      <form
        action={inviteGuestAction}
        className="flex flex-col gap-3 bg-bg-card border border-border p-4"
      >
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Email
          <input
            type="email"
            name="email"
            required
            className="bg-bg-card border border-border px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="bg-cta px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-accent"
        >
          Send invite
        </button>
      </form>

      <section className="bg-bg-card border border-border p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Pending invites
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">None pending.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {pending.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <div className="text-sm">
                  <p className="text-text-primary">{invite.email}</p>
                  <p className="text-xs text-text-secondary">
                    Invited {new Date(invite.invitedAt).toISOString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={resendInviteAction}>
                    <input type="hidden" name="userId" value={invite.id} />
                    <button
                      type="submit"
                      className="border border-dormant px-2 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
                    >
                      Resend
                    </button>
                  </form>
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="userId" value={invite.id} />
                    <button
                      type="submit"
                      className="border border-danger px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10"
                    >
                      Revoke
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/account" className="text-sm text-link underline">
        ← Account
      </Link>
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

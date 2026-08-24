import Link from "next/link";
import { requireRootOr404 } from "@/lib/root-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  upgradeToGuestAction,
  downgradeToVisitorAction,
  triggerPasswordResetAction,
  disableUserAction,
  approvePendingAction,
  declinePendingAction,
  resendInviteFromDashboardAction,
  revokeInviteFromDashboardAction,
} from "./actions";

const ROOT_EMAIL = "kurt@cotoaga.ai";

interface UserRow {
  id: string;
  email: string;
  name: string;
  surname: string;
  tier: string;
  source: string;
  status: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  disabled: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending_invite: "Pending invite",
  pending_confirmation: "Pending confirmation",
  pending_review: "Pending review",
  pending_activation: "Pending activation",
};

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const ts = Date.parse(bannedUntil);
  return !Number.isNaN(ts) && ts > Date.now();
}

async function listUserRows(): Promise<UserRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  return (data?.users ?? [])
    .map((u) => {
      const disabled = isBanned(u.banned_until);
      const isRoot = u.email === ROOT_EMAIL;
      return {
        id: u.id,
        email: u.email ?? "",
        name: u.user_metadata?.name ?? "",
        surname: u.user_metadata?.surname ?? "",
        tier: isRoot ? "root" : (u.app_metadata?.tier ?? "guest"),
        source: u.app_metadata?.source ?? (isRoot ? "root" : "—"),
        status: u.app_metadata?.status ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        disabled,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

const DONE_MESSAGES: Record<string, string> = {
  upgraded: "Account upgraded to guest.",
  downgraded: "Account downgraded to visitor.",
  resetsent: "Password reset mail sent.",
  disabled: "Account disabled.",
  approved: "Request approved. An activation email is on its way.",
  declined: "Request declined and deleted.",
  resent: "Invite resent.",
  revoked: "Invite revoked.",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRootOr404();
  const params = await searchParams;
  const rows = await listUserRows();

  const pendingReview = rows.filter((r) => r.status === "pending_review");

  const doneKey = Object.keys(DONE_MESSAGES).find((key) => params[key]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-hero">
          Users
        </h1>
        <p className="text-sm text-text-secondary">
          Root-only. Native <code className="font-mono text-code">auth.users</code> columns
          — no analytics, no charts.
        </p>
      </header>

      {doneKey ? <Banner text={DONE_MESSAGES[doneKey]} /> : null}
      {params.error ? <Banner text={params.error} tone="danger" /> : null}

      {pendingReview.length > 0 ? (
        <section className="bg-bg-card border border-border p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Pending requests
          </h2>
          <ul className="mt-2 flex flex-col gap-3">
            {pendingReview.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <div className="text-sm">
                  <p className="text-text-primary">
                    {row.name} {row.surname} &lt;{row.email}&gt;
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approvePendingAction}>
                    <input type="hidden" name="userId" value={row.id} />
                    <button
                      type="submit"
                      className="bg-cta px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-accent"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={declinePendingAction}>
                    <input type="hidden" name="userId" value={row.id} />
                    <button
                      type="submit"
                      className="border border-danger px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10"
                    >
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-bg-card border border-border overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-text-primary">{row.email}</td>
                <td className="px-3 py-2 text-text-primary">
                  {row.name} {row.surname}
                </td>
                <td className="px-3 py-2 text-text-secondary">{row.tier}</td>
                <td className="px-3 py-2 text-text-secondary">{row.source}</td>
                <td className="px-3 py-2 text-text-secondary">{formatDate(row.createdAt)}</td>
                <td className="px-3 py-2 text-text-secondary">{formatDate(row.lastSignInAt)}</td>
                <td className="px-3 py-2">
                  <RowActions row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Link href="/account" className="text-sm text-link underline">
        ← Account
      </Link>
    </main>
  );
}

function RowActions({ row }: { row: UserRow }) {
  if (row.tier === "root") {
    return <span className="text-xs text-text-secondary">—</span>;
  }

  if (row.status === "pending_invite") {
    return (
      <div className="flex gap-2">
        <form action={resendInviteFromDashboardAction}>
          <input type="hidden" name="userId" value={row.id} />
          <button
            type="submit"
            className="border border-dormant px-2 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            Resend
          </button>
        </form>
        <form action={revokeInviteFromDashboardAction}>
          <input type="hidden" name="userId" value={row.id} />
          <button
            type="submit"
            className="border border-danger px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10"
          >
            Revoke
          </button>
        </form>
      </div>
    );
  }

  if (row.status && STATUS_LABELS[row.status]) {
    return <span className="text-xs text-text-secondary">{STATUS_LABELS[row.status]}</span>;
  }

  if (row.disabled) {
    return <span className="text-xs text-danger">Disabled</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {row.tier === "visitor" ? (
        <form action={upgradeToGuestAction}>
          <input type="hidden" name="userId" value={row.id} />
          <button
            type="submit"
            className="border border-dormant px-2 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            Upgrade
          </button>
        </form>
      ) : null}
      {row.tier === "guest" ? (
        <form action={downgradeToVisitorAction}>
          <input type="hidden" name="userId" value={row.id} />
          <button
            type="submit"
            className="border border-dormant px-2 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            Downgrade
          </button>
        </form>
      ) : null}
      <form action={triggerPasswordResetAction}>
        <input type="hidden" name="userId" value={row.id} />
        <button
          type="submit"
          className="border border-dormant px-2 py-1 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          Reset password
        </button>
      </form>
      <form action={disableUserAction}>
        <input type="hidden" name="userId" value={row.id} />
        <button
          type="submit"
          className="border border-danger px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10"
        >
          Disable
        </button>
      </form>
    </div>
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

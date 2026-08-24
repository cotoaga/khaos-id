// Guest-invite create/resend/revoke (COT-151). Shared by the invites page
// (/invites) and the root dashboard's per-row actions (/admin/users, COT-152)
// — same three transitions, two entry points.

import { createAdminClient } from "@/lib/supabase/admin";
import { mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { inviteMailBody } from "@/lib/mail/templates";

const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export type GuestInviteOutcome = "ok" | "not_pending" | "error";

export interface GuestInviteResult {
  outcome: GuestInviteOutcome;
  errorMessage?: string;
}

async function sendInviteMail(email: string, userId: string, origin: string): Promise<void> {
  const token = await mintActionToken(
    { sub: userId, purpose: "invite" },
    INVITE_TOKEN_TTL_SECONDS,
  );
  await sendMail({
    to: email,
    subject: "You're invited to khaos-id",
    html: inviteMailBody(`${origin}/activate?token=${token}`),
  });
}

export async function createGuestInvite(
  email: string,
  origin: string,
): Promise<GuestInviteResult> {
  const admin = createAdminClient();
  // Name and surname are the invitee's to set, not root's — they're
  // collected at /activate when the invite is accepted.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: false,
    app_metadata: {
      source: "invited",
      status: "pending_invite",
      invited_at: new Date().toISOString(),
    },
  });

  if (error || !data.user) {
    return { outcome: "error", errorMessage: error?.message ?? "Could not create invite." };
  }

  await sendInviteMail(email, data.user.id, origin);
  return { outcome: "ok" };
}

export async function resendGuestInvite(
  userId: string,
  origin: string,
): Promise<GuestInviteResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_invite") {
    return { outcome: "not_pending" };
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, invited_at: new Date().toISOString() },
  });
  await sendInviteMail(data.user.email!, userId, origin);
  return { outcome: "ok" };
}

export async function revokeGuestInvite(userId: string): Promise<GuestInviteResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_invite") {
    return { outcome: "not_pending" };
  }

  await admin.auth.admin.deleteUser(userId);
  return { outcome: "ok" };
}

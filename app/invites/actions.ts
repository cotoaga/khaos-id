"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRootSession } from "@/lib/root-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { inviteMailBody } from "@/lib/mail/templates";

const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function sendInvite(email: string, userId: string): Promise<void> {
  const origin = await requestOrigin();
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

export async function inviteGuestAction(formData: FormData): Promise<void> {
  await requireRootSession("/invites");

  const email = readField(formData, "email");
  if (!email) {
    redirect(`/invites?error=${encodeURIComponent("Email is required.")}`);
  }

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
    redirect(`/invites?error=${encodeURIComponent(error?.message ?? "Could not create invite.")}`);
  }

  await sendInvite(email, data.user.id);
  redirect("/invites?invited=1");
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  await requireRootSession("/invites");

  const userId = readField(formData, "userId");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_invite") {
    redirect(`/invites?error=${encodeURIComponent("Invite not found or already accepted.")}`);
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, invited_at: new Date().toISOString() },
  });
  await sendInvite(data.user.email!, userId);
  redirect("/invites?resent=1");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  await requireRootSession("/invites");

  const userId = readField(formData, "userId");
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_invite") {
    redirect(`/invites?error=${encodeURIComponent("Invite not found or already accepted.")}`);
  }

  await admin.auth.admin.deleteUser(userId);
  redirect("/invites?revoked=1");
}

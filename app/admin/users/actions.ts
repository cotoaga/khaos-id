"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRootOr404 } from "@/lib/root-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/resend";
import { resetTriggeredMailBody } from "@/lib/mail/templates";
import { approveVisitorRequest, declineVisitorRequest } from "@/lib/account-review";
import { resendGuestInvite, revokeGuestInvite } from "@/lib/guest-invite";

// Hardwired root identity (COT-150) — mirrors the custom_access_token_hook
// migration. Root's tier and login are never touched from this dashboard.
const ROOT_EMAIL = "kurt@cotoaga.ai";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function readUserId(formData: FormData): string {
  const value = formData.get("userId");
  return typeof value === "string" ? value : "";
}

function bounce(error: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(error)}`);
}

export async function upgradeToGuestAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) bounce("User not found.");
  if (data.user.email === ROOT_EMAIL) bounce("Cannot change root's tier.");
  if (data.user.app_metadata?.tier !== "visitor") {
    bounce("Only a visitor can be upgraded to guest.");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, tier: "guest" },
  });
  if (updateError) bounce("Could not upgrade this account.");

  redirect("/admin/users?upgraded=1");
}

export async function downgradeToVisitorAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) bounce("User not found.");
  if (data.user.email === ROOT_EMAIL) bounce("Cannot change root's tier.");
  if (data.user.app_metadata?.tier !== "guest") {
    bounce("Only a guest can be downgraded to visitor.");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, tier: "visitor" },
  });
  if (updateError) bounce("Could not downgrade this account.");

  redirect("/admin/users?downgraded=1");
}

export async function triggerPasswordResetAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || !data.user.email) bounce("User not found.");

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: data.user.email,
  });
  if (linkError || !linkData) bounce("Could not generate a reset link.");

  const origin = await requestOrigin();
  const resetUrl = `${origin}/reset?token_hash=${linkData.properties.hashed_token}&type=recovery`;
  await sendMail({
    to: data.user.email,
    subject: "Reset your khaos-id password",
    html: resetTriggeredMailBody(resetUrl),
  });

  redirect("/admin/users?resetsent=1");
}

export async function disableUserAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) bounce("User not found.");
  if (data.user.email === ROOT_EMAIL) bounce("Cannot disable root.");

  // Supabase has no "permanent" ban — 100 years is the ecosystem's stand-in.
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
  if (updateError) bounce("Could not disable this account.");

  redirect("/admin/users?disabled=1");
}

export async function approvePendingAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);
  const origin = await requestOrigin();

  const result = await approveVisitorRequest(userId, origin);
  if (result.outcome === "already_handled") bounce("This request was already handled.");
  if (result.outcome === "error") {
    bounce(result.errorMessage ?? "Could not approve this request.");
  }

  redirect("/admin/users?approved=1");
}

export async function declinePendingAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);

  const result = await declineVisitorRequest(userId);
  if (result.outcome === "already_handled") bounce("This request was already handled.");

  redirect("/admin/users?declined=1");
}

export async function resendInviteFromDashboardAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);
  const origin = await requestOrigin();

  const result = await resendGuestInvite(userId, origin);
  if (result.outcome === "not_pending") bounce("Invite not found or already accepted.");

  redirect("/admin/users?resent=1");
}

export async function revokeInviteFromDashboardAction(formData: FormData): Promise<void> {
  await requireRootOr404();
  const userId = readUserId(formData);

  const result = await revokeGuestInvite(userId);
  if (result.outcome === "not_pending") bounce("Invite not found or already accepted.");

  redirect("/admin/users?revoked=1");
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRootSession } from "@/lib/root-guard";
import { createGuestInvite, resendGuestInvite, revokeGuestInvite } from "@/lib/guest-invite";

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

export async function inviteGuestAction(formData: FormData): Promise<void> {
  await requireRootSession("/invites");

  const email = readField(formData, "email");
  if (!email) {
    redirect(`/invites?error=${encodeURIComponent("Email is required.")}`);
  }

  const origin = await requestOrigin();
  const result = await createGuestInvite(email, origin);
  if (result.outcome === "error") {
    redirect(`/invites?error=${encodeURIComponent(result.errorMessage ?? "Could not create invite.")}`);
  }

  redirect("/invites?invited=1");
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  await requireRootSession("/invites");

  const userId = readField(formData, "userId");
  const origin = await requestOrigin();
  const result = await resendGuestInvite(userId, origin);
  if (result.outcome === "not_pending") {
    redirect(`/invites?error=${encodeURIComponent("Invite not found or already accepted.")}`);
  }

  redirect("/invites?resent=1");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  await requireRootSession("/invites");

  const userId = readField(formData, "userId");
  const result = await revokeGuestInvite(userId);
  if (result.outcome === "not_pending") {
    redirect(`/invites?error=${encodeURIComponent("Invite not found or already accepted.")}`);
  }

  redirect("/invites?revoked=1");
}

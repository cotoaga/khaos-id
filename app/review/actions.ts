"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRootSession } from "@/lib/root-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyActionToken, mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { activateVisitorMailBody } from "@/lib/mail/templates";

const ACTIVATE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function readToken(formData: FormData): string {
  const token = formData.get("token");
  return typeof token === "string" ? token : "";
}

export async function approveRequestAction(formData: FormData): Promise<void> {
  await requireRootSession("/review");
  const token = readToken(formData);

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, "review_request"));
  } catch {
    redirect(`/review?token=${encodeURIComponent(token)}&error=${encodeURIComponent("This review link is invalid or has expired.")}`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(sub);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_review") {
    redirect("/review?done=alreadyhandled");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(sub, {
    app_metadata: {
      ...data.user.app_metadata,
      tier: "visitor",
      status: "pending_activation",
    },
  });
  if (updateError) {
    redirect(`/review?token=${encodeURIComponent(token)}&error=${encodeURIComponent("Could not approve this request.")}`);
  }

  const origin = await requestOrigin();
  const activateToken = await mintActionToken(
    { sub, purpose: "activate_visitor" },
    ACTIVATE_TOKEN_TTL_SECONDS,
  );
  await sendMail({
    to: data.user.email!,
    subject: "Your khaos-id access request was approved",
    html: activateVisitorMailBody(`${origin}/activate?token=${activateToken}`),
  });

  redirect("/review?done=approved");
}

export async function declineRequestAction(formData: FormData): Promise<void> {
  await requireRootSession("/review");
  const token = readToken(formData);

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, "review_request"));
  } catch {
    redirect(`/review?token=${encodeURIComponent(token)}&error=${encodeURIComponent("This review link is invalid or has expired.")}`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(sub);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_review") {
    redirect("/review?done=alreadyhandled");
  }

  // Hard delete — data minimization (Kurt-ratified 2026-08-24). No corpse table.
  await admin.auth.admin.deleteUser(sub);
  redirect("/review?done=declined");
}

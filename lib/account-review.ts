// Visitor-request approve/decline state transition (COT-151). Shared by the
// mailed review link (/review, token-authenticated) and the root dashboard
// queue (/admin/users, session-authenticated) — same transition, two entry
// points (COT-152).

import { createAdminClient } from "@/lib/supabase/admin";
import { mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { activateVisitorMailBody } from "@/lib/mail/templates";

const ACTIVATE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export type ReviewOutcome = "approved" | "declined" | "already_handled" | "error";

export interface ReviewResult {
  outcome: ReviewOutcome;
  errorMessage?: string;
}

export async function approveVisitorRequest(
  sub: string,
  origin: string,
): Promise<ReviewResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(sub);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_review") {
    return { outcome: "already_handled" };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(sub, {
    app_metadata: {
      ...data.user.app_metadata,
      tier: "visitor",
      status: "pending_activation",
    },
  });
  if (updateError) {
    return { outcome: "error", errorMessage: "Could not approve this request." };
  }

  const activateToken = await mintActionToken(
    { sub, purpose: "activate_visitor" },
    ACTIVATE_TOKEN_TTL_SECONDS,
  );
  await sendMail({
    to: data.user.email!,
    subject: "Your khaos-id access request was approved",
    html: activateVisitorMailBody(`${origin}/activate?token=${activateToken}`),
  });

  return { outcome: "approved" };
}

export async function declineVisitorRequest(sub: string): Promise<ReviewResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(sub);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_review") {
    return { outcome: "already_handled" };
  }

  // Hard delete — data minimization (Kurt-ratified 2026-08-24). No corpse table.
  await admin.auth.admin.deleteUser(sub);
  return { outcome: "declined" };
}

"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyActionToken, type ActionTokenPurpose } from "@/lib/action-token";
import { mintAndSetSessionDeadlineCookie } from "@/lib/session-deadline";

const EXPECTED_STATUS: Record<Extract<ActionTokenPurpose, "invite" | "activate_visitor">, string> = {
  invite: "pending_invite",
  activate_visitor: "pending_activation",
};

function bounce(token: string, error: string): never {
  redirect(`/activate?token=${encodeURIComponent(token)}&error=${encodeURIComponent(error)}`);
}

export async function setCredentialsAction(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const purposeRaw = formData.get("purpose");
  const password = formData.get("password");
  const name = formData.get("name");
  const surname = formData.get("surname");

  if (typeof token !== "string" || !token) {
    redirect("/login?error=" + encodeURIComponent("Missing activation token."));
  }
  if (purposeRaw !== "invite" && purposeRaw !== "activate_visitor") {
    bounce(token, "Invalid activation request.");
  }
  const purpose = purposeRaw;

  if (typeof password !== "string" || password.length < 6) {
    bounce(token, "Password must be at least 6 characters.");
  }
  if (purpose === "invite") {
    if (typeof name !== "string" || !name.trim() || typeof surname !== "string" || !surname.trim()) {
      bounce(token, "Name and surname are required.");
    }
  }

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, purpose));
  } catch {
    bounce(token, "This link is invalid or has expired.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(sub);
  if (error || !data.user || data.user.app_metadata?.status !== EXPECTED_STATUS[purpose]) {
    bounce(token, "This link has already been used.");
  }

  const user = data.user;
  const nextAppMetadata = { ...user.app_metadata };
  delete nextAppMetadata.status;
  const nextUserMetadata =
    purpose === "invite"
      ? { ...user.user_metadata, name: (name as string).trim(), surname: (surname as string).trim() }
      : user.user_metadata;

  const { error: updateError } = await admin.auth.admin.updateUserById(sub, {
    password,
    email_confirm: true,
    user_metadata: nextUserMetadata,
    app_metadata: nextAppMetadata,
  });
  if (updateError) bounce(token, "Could not activate your account. Try again.");

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  });
  if (signInError) {
    redirect("/login?error=" + encodeURIComponent("Account activated — please sign in."));
  }

  await mintAndSetSessionDeadlineCookie(nextUserMetadata);
  redirect("/account");
}

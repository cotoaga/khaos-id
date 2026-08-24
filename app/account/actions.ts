"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { confirmEmailChangeMailBody } from "@/lib/mail/templates";

const EMAIL_CHANGE_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h to confirm the new mailbox

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

function bounceWithError(error: string): never {
  redirect(`/account?error=${encodeURIComponent(error)}`);
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const name = readField(formData, "name");
  const surname = readField(formData, "surname");
  if (!name || !surname) bounceWithError("Name and surname are required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ data: { name, surname } });
  if (error) bounceWithError(error.message);

  redirect("/account?profileUpdated=1");
}

export async function requestEmailChangeAction(formData: FormData): Promise<void> {
  const newEmail = readField(formData, "email");
  if (!newEmail) bounceWithError("A new email is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (newEmail === user.email) bounceWithError("That's already your email.");

  const origin = await requestOrigin();
  const token = await mintActionToken(
    { sub: user.id, purpose: "confirm_email_change", newEmail },
    EMAIL_CHANGE_TOKEN_TTL_SECONDS,
  );
  await sendMail({
    to: newEmail,
    subject: "Confirm your new khaos-id email",
    html: confirmEmailChangeMailBody(`${origin}/account/confirm-email?token=${token}`),
  });

  redirect("/account?emailChangeSent=1");
}

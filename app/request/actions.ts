"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { confirmRequestMailBody } from "@/lib/mail/templates";

const CONFIRM_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h to confirm mailbox
const THROTTLE_COOKIE = "khaos_request_throttle";
const THROTTLE_SECONDS = 300;

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

// Same-browser resubmit throttle. Not a defense against a distributed bot,
// but combined with the honeypot and the mailbox-confirmation gate below,
// nothing reaches Kurt's inbox without a human clicking a real mail link.
async function isThrottled(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.has(THROTTLE_COOKIE);
}

async function setThrottleCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(THROTTLE_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/request",
    maxAge: THROTTLE_SECONDS,
  });
}

export async function submitRequestAction(formData: FormData): Promise<void> {
  const email = readField(formData, "email");
  const name = readField(formData, "name");
  const surname = readField(formData, "surname");
  // Honeypot: real visitors never see or fill this field.
  const honeypot = readField(formData, "company");

  if (!email || !name || !surname) {
    redirect(
      `/request?error=${encodeURIComponent("Email, name, and surname are required.")}`,
    );
  }

  if (honeypot || (await isThrottled())) {
    await setThrottleCookie();
    redirect("/request?sent=1");
  }

  const origin = await requestOrigin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: false,
    user_metadata: { name, surname },
    app_metadata: { source: "requested", status: "pending_confirmation" },
  });

  await setThrottleCookie();

  // Never confirm or deny whether an email is already registered.
  if (error || !data.user) {
    redirect("/request?sent=1");
  }

  const token = await mintActionToken(
    { sub: data.user.id, purpose: "confirm_request" },
    CONFIRM_TOKEN_TTL_SECONDS,
  );
  await sendMail({
    to: email,
    subject: "Confirm your khaos-id access request",
    html: confirmRequestMailBody(`${origin}/request/confirm?token=${token}`),
  });

  redirect("/request?sent=1");
}

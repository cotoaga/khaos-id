"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData): {
  email: string;
  password: string;
} | null {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return null;
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) return null;
  return { email: trimmedEmail, password };
}

function readEmail(formData: FormData): string | null {
  const email = formData.get("email");
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  return trimmed || null;
}

function readPassword(formData: FormData): string | null {
  const password = formData.get("password");
  if (typeof password !== "string" || !password) return null;
  return password;
}

function bounceWithError(target: string, error: string): never {
  redirect(`${target}?error=${encodeURIComponent(error)}`);
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function signupAction(formData: FormData): Promise<void> {
  const creds = readCredentials(formData);
  if (!creds) bounceWithError("/signup", "Email and password are required.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: creds.email,
    password: creds.password,
  });

  if (error) bounceWithError("/signup", error.message);
  redirect("/account");
}

export async function loginAction(formData: FormData): Promise<void> {
  const creds = readCredentials(formData);
  if (!creds) bounceWithError("/login", "Email and password are required.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });

  if (error) bounceWithError("/login", error.message);
  redirect("/account");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<void> {
  const email = readEmail(formData);
  if (!email) bounceWithError("/forgot", "Email is required.");

  const origin = await requestOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset`,
  });

  // Always return the same neutral confirmation — never leak which addresses
  // are registered.
  redirect("/forgot?sent=1");
}

export async function updatePasswordAction(formData: FormData): Promise<void> {
  const password = readPassword(formData);
  if (!password)
    bounceWithError("/reset/confirm", "A new password is required.");
  if (password.length < 6)
    bounceWithError("/reset/confirm", "Password must be at least 6 characters.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) bounceWithError("/reset/confirm", error.message);
  redirect("/account");
}

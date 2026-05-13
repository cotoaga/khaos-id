"use server";

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

function bounceWithError(target: string, error: string): never {
  redirect(`${target}?error=${encodeURIComponent(error)}`);
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

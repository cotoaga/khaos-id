import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyActionToken } from "@/lib/action-token";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  const bounce = (error: string) =>
    NextResponse.redirect(new URL(`/account?error=${encodeURIComponent(error)}`, request.url));

  if (!token) return bounce("Missing confirmation token.");

  let sub: string;
  let newEmail: string;
  try {
    const result = await verifyActionToken(token, "confirm_email_change");
    sub = result.sub;
    newEmail = result.newEmail!;
  } catch {
    return bounce("This confirmation link is invalid or has expired.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(sub, {
    email: newEmail,
    email_confirm: true,
  });
  if (error) return bounce("Could not confirm your new email. It may already be in use.");

  return NextResponse.redirect(new URL("/account?emailChanged=1", request.url));
}

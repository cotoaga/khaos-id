import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyActionToken, mintActionToken } from "@/lib/action-token";
import { sendMail } from "@/lib/mail/resend";
import { notifyRootMailBody } from "@/lib/mail/templates";

const REVIEW_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const ROOT_EMAIL = "kurt@cotoaga.net"; // matches the account-model root hardwire (COT-150)

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");
  const bounce = (error: string) =>
    NextResponse.redirect(
      new URL(`/request?error=${encodeURIComponent(error)}`, request.url),
    );

  if (!token) return bounce("Missing confirmation token.");

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, "confirm_request"));
  } catch {
    return bounce("This confirmation link is invalid or has expired.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(sub);
  if (error || !data.user || data.user.app_metadata?.status !== "pending_confirmation") {
    return bounce("This confirmation link has already been used.");
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(sub, {
    app_metadata: { ...data.user.app_metadata, status: "pending_review" },
  });
  if (updateError) return bounce("Could not confirm your request. Try again.");

  const reviewToken = await mintActionToken(
    { sub, purpose: "review_request" },
    REVIEW_TOKEN_TTL_SECONDS,
  );
  const reviewUrl = new URL(`/review?token=${reviewToken}`, request.url).toString();
  await sendMail({
    to: ROOT_EMAIL,
    subject: "khaos-id: new access request pending review",
    html: notifyRootMailBody(reviewUrl, {
      email: data.user.email ?? "",
      name: data.user.user_metadata?.name ?? "",
      surname: data.user.user_metadata?.surname ?? "",
    }),
  });

  return NextResponse.redirect(new URL("/request?confirmed=1", request.url));
}

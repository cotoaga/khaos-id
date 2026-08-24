// Gate for root-only server-rendered pages and actions (COT-151: guest
// invite trigger, pending-invite list, visitor-request review). Distinct
// from middleware's auth check — this also verifies the `tier` claim the
// custom access-token hook stamps (COT-150), since middleware only knows
// "is there a session," not "is this session root."

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyAccessToken } from "@/lib/jwt";

export interface RootSession {
  userId: string;
  email: string;
}

export async function requireRootSession(
  redirectTo: string,
): Promise<RootSession> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  let tier: unknown;
  try {
    const { payload } = await verifyAccessToken(session.access_token);
    tier = payload.tier;
  } catch {
    redirect(
      `/login?error=${encodeURIComponent("Session verification failed.")}`,
    );
  }

  if (tier !== "root") {
    redirect(`/account?error=${encodeURIComponent("Root access required.")}`);
  }

  return { userId: session.user.id, email: session.user.email ?? "" };
}

// Hard-404 variant for surfaces that must not reveal their own existence to
// non-root visitors (COT-152: /admin/users). Unlike requireRootSession, this
// never redirects — an anonymous visitor and an authenticated guest get the
// identical 404 a root typo would get.
export async function requireRootOr404(): Promise<RootSession> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) notFound();

  let tier: unknown;
  try {
    const { payload } = await verifyAccessToken(session.access_token);
    tier = payload.tier;
  } catch {
    notFound();
  }

  if (tier !== "root") notFound();

  return { userId: session.user.id, email: session.user.email ?? "" };
}

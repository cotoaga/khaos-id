// Absolute session deadline (COT-91).
//
// The JWT's own expiry (3600s, Supabase project config) is untouched and
// keeps refreshing the session forever. This is a second, independent clock:
// a signed cookie that says "this session dies at T", minted once at login
// from the user's session_lifetime_pref and never extended by anything the
// client can influence. See docs/architecture.md for the trust boundary this
// sits alongside.

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_DEADLINE_COOKIE = "khaos_session_deadline";

export const SESSION_LIFETIME_PREFS = ["1h", "1d", "7d"] as const;
export type SessionLifetimePref = (typeof SESSION_LIFETIME_PREFS)[number];
export const DEFAULT_SESSION_LIFETIME_PREF: SessionLifetimePref = "1d";

const LIFETIME_SECONDS: Record<SessionLifetimePref, number> = {
  "1h": 60 * 60,
  "1d": 60 * 60 * 24,
  "7d": 60 * 60 * 24 * 7,
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_DEADLINE_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_DEADLINE_SECRET is not set — cannot mint or verify the session deadline cookie",
    );
  }
  return new TextEncoder().encode(secret);
}

export function resolveSessionLifetimePref(metadata: unknown): SessionLifetimePref {
  if (metadata && typeof metadata === "object" && "session_lifetime_pref" in metadata) {
    const value = (metadata as Record<string, unknown>).session_lifetime_pref;
    if (SESSION_LIFETIME_PREFS.includes(value as SessionLifetimePref)) {
      return value as SessionLifetimePref;
    }
  }
  return DEFAULT_SESSION_LIFETIME_PREF;
}

export async function mintSessionDeadline(
  pref: SessionLifetimePref,
  now: number = Math.floor(Date.now() / 1000),
): Promise<{ token: string; deadline: number; maxAge: number }> {
  const maxAge = LIFETIME_SECONDS[pref];
  const deadline = now + maxAge;
  const token = await new SignJWT({ deadline })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(deadline)
    .sign(secretKey());
  return { token, deadline, maxAge };
}

export async function verifySessionDeadline(token: string): Promise<{ deadline: number }> {
  const { payload } = await jwtVerify(token, secretKey());
  if (typeof payload.deadline !== "number") {
    throw new Error("Malformed session deadline token");
  }
  return { deadline: payload.deadline };
}

// Failure-safe variant for call sites that only need to know "is this still
// good" (middleware gate, account page display) without handling the throw.
export async function safeVerifySessionDeadline(
  token: string | undefined,
): Promise<{ deadline: number } | null> {
  if (!token) return null;
  try {
    return await verifySessionDeadline(token);
  } catch {
    return null;
  }
}

export function sessionDeadlineCookieOptions(maxAge: number) {
  const domain = process.env.COOKIE_DOMAIN;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

// Called from every place a live session is established: loginAction,
// signupAction, and the recovery-link verifyOtp exchange.
export async function mintAndSetSessionDeadlineCookie(userMetadata: unknown): Promise<void> {
  const pref = resolveSessionLifetimePref(userMetadata);
  const { token, maxAge } = await mintSessionDeadline(pref);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_DEADLINE_COOKIE, token, sessionDeadlineCookieOptions(maxAge));
}

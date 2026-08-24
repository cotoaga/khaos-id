// Signed, single-purpose action tokens for mail-based flows (COT-151).
//
// Guest invite, visitor double-opt-in, root review, and credential-activation
// links all carry one of these instead of a Supabase-minted OTP link — we
// send every one of these emails via Resend ourselves, so we also own the
// token that proves the click is legitimate. A purpose tag stops a token
// minted for one flow (e.g. "confirm your mailbox") from being replayed
// against another (e.g. "set your password").

import { jwtVerify, SignJWT } from "jose";

export const ACTION_TOKEN_PURPOSES = [
  "invite",
  "confirm_request",
  "review_request",
  "activate_visitor",
  "confirm_email_change",
] as const;
export type ActionTokenPurpose = (typeof ACTION_TOKEN_PURPOSES)[number];

export interface ActionTokenPayload {
  sub: string;
  purpose: ActionTokenPurpose;
  // Only carried by "confirm_email_change" — the address being confirmed.
  // Keeping it in the signed token (rather than a DB write) means the old
  // address stays the account's email until this exact link is clicked.
  newEmail?: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.ACTION_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "ACTION_TOKEN_SECRET is not set — cannot mint or verify action tokens",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function mintActionToken(
  payload: ActionTokenPayload,
  expiresInSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({ purpose: payload.purpose, newEmail: payload.newEmail })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey());
}

export async function verifyActionToken(
  token: string,
  expectedPurpose: ActionTokenPurpose,
): Promise<ActionTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Malformed action token: missing subject");
  }
  if (payload.purpose !== expectedPurpose) {
    throw new Error(
      `Action token purpose mismatch: expected "${expectedPurpose}", got "${String(payload.purpose)}"`,
    );
  }
  if (expectedPurpose === "confirm_email_change") {
    if (typeof payload.newEmail !== "string" || !payload.newEmail) {
      throw new Error("Malformed action token: missing newEmail");
    }
    return { sub: payload.sub, purpose: expectedPurpose, newEmail: payload.newEmail };
  }
  return { sub: payload.sub, purpose: expectedPurpose };
}

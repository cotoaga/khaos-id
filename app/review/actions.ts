"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireRootSession } from "@/lib/root-guard";
import { verifyActionToken } from "@/lib/action-token";
import { approveVisitorRequest, declineVisitorRequest } from "@/lib/account-review";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function readToken(formData: FormData): string {
  const token = formData.get("token");
  return typeof token === "string" ? token : "";
}

export async function approveRequestAction(formData: FormData): Promise<void> {
  await requireRootSession("/review");
  const token = readToken(formData);

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, "review_request"));
  } catch {
    redirect(`/review?token=${encodeURIComponent(token)}&error=${encodeURIComponent("This review link is invalid or has expired.")}`);
  }

  const origin = await requestOrigin();
  const result = await approveVisitorRequest(sub, origin);

  if (result.outcome === "already_handled") {
    redirect("/review?done=alreadyhandled");
  }
  if (result.outcome === "error") {
    redirect(`/review?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.errorMessage ?? "Could not approve this request.")}`);
  }
  redirect("/review?done=approved");
}

export async function declineRequestAction(formData: FormData): Promise<void> {
  await requireRootSession("/review");
  const token = readToken(formData);

  let sub: string;
  try {
    ({ sub } = await verifyActionToken(token, "review_request"));
  } catch {
    redirect(`/review?token=${encodeURIComponent(token)}&error=${encodeURIComponent("This review link is invalid or has expired.")}`);
  }

  const result = await declineVisitorRequest(sub);
  if (result.outcome === "already_handled") {
    redirect("/review?done=alreadyhandled");
  }
  redirect("/review?done=declined");
}

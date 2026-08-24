import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST performs the sign-out. The redirect is 303 (See Other) — a 307 would
// preserve the method and re-POST the landing page, which only serves GET.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[logout] signOut failed:", error.message);
  return NextResponse.redirect(new URL("/", request.url), 303);
}

// GET never signs anyone out — CSRF stance: a bare <img>/<a> pointed here must
// have zero effect on the session. It exists only so typed URLs and stale
// bookmarks land somewhere humane instead of a raw 405.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}

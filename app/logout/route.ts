import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only — logout must not be triggerable via a plain GET (CSRF: a bare
// <img>/<a> to this URL would otherwise log a visiting user out silently).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[logout] signOut failed:", error.message);
  return NextResponse.redirect(new URL("/", request.url));
}

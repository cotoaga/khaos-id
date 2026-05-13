import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">khaos-id</h1>
        <p className="text-sm text-neutral-500">
          Federated identity for the KHAOS ecosystem. Email + password against a
          local Supabase Auth, with JWTs verifiable by any sibling service.
        </p>
      </header>

      {user ? (
        <nav className="flex flex-col gap-3">
          <p className="text-sm">
            Signed in as <strong>{user.email}</strong>.
          </p>
          <Link className="underline" href="/account">
            View JWT claims →
          </Link>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-left text-sm text-neutral-600 underline hover:text-neutral-900"
            >
              Sign out
            </button>
          </form>
        </nav>
      ) : (
        <nav className="flex flex-col gap-3">
          <Link className="underline" href="/login">
            Sign in →
          </Link>
          <Link className="underline" href="/signup">
            Create an account →
          </Link>
        </nav>
      )}
    </main>
  );
}

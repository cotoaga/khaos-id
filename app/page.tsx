import Link from "next/link";
import { Cormorant_Garamond, JetBrains_Mono } from "next/font/google";

import MonadField from "@/components/hero/MonadField";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jetbrainsHero = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["200", "300", "400"],
  variable: "--font-jetbrains",
  display: "swap",
});

export default function Home() {
  return (
    <main
      className={`${cormorant.variable} ${jetbrainsHero.variable} min-h-screen bg-[var(--cotoaga-ai-deep-sky)] text-[var(--brand-text-body)]`}
    >
      <MonadField />
      <section className="flex flex-col items-center justify-center gap-6 border-t border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-20 font-mono text-sm uppercase tracking-[0.18em] sm:flex-row sm:gap-12">
        <Link
          href="/login"
          className="inline-block border border-[var(--brand-primary)] px-7 py-3 text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-[var(--brand-button-text)] hover:shadow-[0_4px_16px_rgba(0,168,107,0.25)]"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="inline-block border border-[var(--brand-accent)] px-7 py-3 text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)] hover:text-[var(--cotoaga-ai-deep-sky)] hover:shadow-[var(--brand-hover-shadow)]"
        >
          Create account
        </Link>
      </section>
    </main>
  );
}

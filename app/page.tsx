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

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["200", "300", "400"],
  variable: "--font-jetbrains",
  display: "swap",
});

const ctaLink =
  "border-b border-[#c8a050]/30 pb-1 text-[#c8a050] uppercase tracking-[0.25em] transition hover:border-[#dcb964] hover:text-[#dcb964]";

export default function Home() {
  return (
    <main
      className={`${cormorant.variable} ${jetbrainsMono.variable} min-h-screen bg-[#07070c] text-[#d4cfc6]`}
    >
      <MonadField />
      <section
        className="flex flex-col items-center justify-center gap-8 px-6 py-24 sm:flex-row sm:gap-16"
        style={{ fontFamily: "var(--font-jetbrains), monospace" }}
      >
        <Link href="/login" className={`${ctaLink} text-xs sm:text-sm`}>
          Sign in
        </Link>
        <Link href="/signup" className={`${ctaLink} text-xs sm:text-sm`}>
          Create account
        </Link>
      </section>
    </main>
  );
}

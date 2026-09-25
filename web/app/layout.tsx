import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NOVA",
  description: "Tell NOVA what you need. NOVA figures out how to get it done.",
};

const nav = [
  ["Home", "/"],
  ["Chat", "/chat"],
  ["Tasks", "/tasks"],
  ["Discover", "/discover"],
  ["Passport", "/passport"],
  ["Notifications", "/notifications"],
  ["Profile", "/profile"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-soft">
              <Link href="/" className="text-xl font-semibold tracking-tight text-ink">
                NOVA
              </Link>
              <nav className="flex flex-wrap gap-2 text-sm text-gray-600" aria-label="Main navigation">
                {nav.map(([label, href]) => (
                  <Link key={href} href={href} className="rounded-full px-3 py-2 hover:bg-mist">
                    {label}
                  </Link>
                ))}
              </nav>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

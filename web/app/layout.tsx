import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { UserShell } from "@/components/user-shell";

export const metadata: Metadata = {
  title: "NOVA",
  description: "Tell NOVA what you need. NOVA figures out how to get it done.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>
          <UserShell>{children}</UserShell>
        </Providers>
      </body>
    </html>
  );
}

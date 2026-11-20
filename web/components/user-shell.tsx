"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ApiError, apiFetch, clearTokens, getAccessToken, logout } from "@/lib/api";
import { Button, LoadingState, cn } from "@/components/ui";

const navigation = [
  ["Dashboard", "/app"],
  ["Assistant NOVA", "/chat"],
  ["Conversations", "/conversations"],
  ["Tasks", "/tasks"],
  ["Service requests", "/service-requests"],
  ["Profile", "/profile"],
];

type CurrentUser = { email: string; full_name: string | null; role: string };

export function UserShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/register";
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isAdmin = pathname?.startsWith("/admin");
  const hasToken = mounted && Boolean(getAccessToken());
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<CurrentUser>("/api/v1/me"), enabled: !isPublic && !isAdmin && hasToken, retry: false });

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || isPublic || isAdmin) return;
    if (!hasToken || (me.error instanceof ApiError && me.error.status === 401)) {
      clearTokens();
      router.replace("/login");
    }
  }, [hasToken, isAdmin, isPublic, me.error, mounted, router]);

  if (isAdmin) return <main className="mx-auto min-h-screen w-full max-w-7xl px-3 py-3 sm:px-6 lg:px-8">{children}</main>;
  if (isPublic) return isAuthPage ? <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-3 py-8 sm:px-6 lg:px-8">{children}</main> : <main className="min-h-screen">{children}</main>;
  if (!mounted || !hasToken || me.isLoading) return <main className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-6 lg:px-8"><LoadingState label="Checking your session..." /></main>;
  if (me.error) return null;

  const displayName = me.data?.full_name || me.data?.email || "User";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-6 lg:px-8">
      <header className="sticky top-3 z-20 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-white/70 bg-white/90 px-4 py-3 shadow-soft backdrop-blur sm:px-5">
        <Link href="/app" className="flex items-center gap-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"><span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-semibold text-white">N</span><span className="text-xl font-semibold tracking-tight text-ink">NOVA</span></Link>
        <nav className="order-3 flex w-full gap-1 overflow-x-auto text-sm text-gray-600 lg:order-none lg:w-auto" aria-label="User navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href} className={cn("whitespace-nowrap rounded-full px-3 py-2 transition hover:bg-mist", pathname === href && "bg-mist text-ink")}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2 text-sm"><Link href="/profile" className="max-w-40 truncate rounded-full bg-mist px-3 py-2" title={me.data?.email}>{displayName}</Link><Button type="button" variant="secondary" className="min-h-10 px-4" onClick={async () => { await logout(); router.replace("/login"); }}>Logout</Button></div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

"use client";

import React from "react";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell, EmptyState, ErrorState, LinkButton, LoadingState } from "@/components/ui";
import { ApiError, apiFetch, clearTokens, getAccessToken } from "@/lib/api";

type Me = { email: string; role: string };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasToken = Boolean(getAccessToken());
  const me = useQuery({ queryKey: ["admin-me"], queryFn: () => apiFetch<Me>("/api/v1/me"), enabled: hasToken, retry: false });
  if (!hasToken || (me.error instanceof ApiError && me.error.status === 401)) return <EmptyState title="Admin login required" action={<LinkButton href="/login">Login</LinkButton>} />;
  if (me.isLoading) return <LoadingState label="Checking admin access..." />;
  if (me.error) return <ErrorState message={me.error.message} />;
  if (me.data?.role !== "admin") return <ErrorState title="Access denied" message="An administrator account is required." />;
  return (
    <AdminShell adminEmail={me.data?.email} onLogout={() => { clearTokens(); router.push("/login"); }}>
      {children}
    </AdminShell>
  );
}

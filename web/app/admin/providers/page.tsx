"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, AdminProvider, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { Badge, EmptyState, LoadingState, Pagination } from "@/components/ui";

export default function AdminProvidersPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, error, isLoading } = useQuery<AdminPage<AdminProvider>>({ queryKey: ["admin-providers", offset], queryFn: () => apiFetch<AdminPage<AdminProvider>>(`/api/v1/admin/providers?limit=${limit}&offset=${offset}`), enabled: hasToken });
  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />;
  if (isLoading) return <LoadingState label="Loading providers..." />;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">Providers</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {data?.items.map((provider: AdminProvider) => <div key={provider.id} className="rounded-2xl border border-gray-100 p-4"><Badge className={provider.demo ? "bg-amber-100 text-amber-900" : undefined}>{provider.demo ? "Demo" : "Provider"}</Badge><p className="mt-2 font-semibold">{provider.name}</p><p className="text-sm text-gray-600">{provider.location}</p><p className="text-xs text-gray-400">Verified: {String(provider.verified)}</p></div>)}
      </div>
      {data?.items.length === 0 && <EmptyState title="No providers found" />}
      {data && <Pagination limit={limit} offset={offset} total={data.total} onPrevious={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />}
    </section>
  );
}

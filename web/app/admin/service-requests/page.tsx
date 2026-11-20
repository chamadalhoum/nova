"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, AdminServiceRequest, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { CopyButton, DataTable, EmptyState, FilterBar, LinkButton, LoadingState, Pagination, StatusBadge } from "@/components/ui";

export default function AdminServiceRequestsPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const limit = 50;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set("status", status);
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-service-requests", offset, status], queryFn: () => apiFetch<AdminPage<AdminServiceRequest>>(`/api/v1/admin/service-requests?${params}`), enabled: hasToken });
  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />;
  if (isLoading) return <LoadingState label="Loading service requests..." />;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">Service requests</h2>
      <p className="mt-2 text-sm text-gray-600">Internal NOVA requests only. No real booking, provider contact, or payment is connected.</p>
      <div className="mt-5"><FilterBar><select className="min-h-11 rounded-2xl border px-3" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">All statuses</option><option value="PREPARED">PREPARED</option><option value="CONFIRMED">CONFIRMED</option></select></FilterBar></div>
      <div className="mt-5"><DataTable<AdminServiceRequest> rows={data?.items ?? []} getKey={(request) => request.id} columns={[{ key: "request", header: "Request", render: (request) => <div><p className="font-medium text-ink">{request.category || "Uncategorized"}</p><p className="text-xs text-gray-500">{request.location || "No location"}</p></div> }, { key: "status", header: "Status", render: (request) => <StatusBadge status={request.status} /> }, { key: "user", header: "User", render: (request) => <span className="text-xs text-gray-500">{request.user_id}</span> }, { key: "provider", header: "Provider", render: (request) => request.provider_id ? <CopyButton value={request.provider_id} label="Copy provider" /> : "None" }, { key: "actions", header: "Actions", render: (request) => <div className="flex gap-1"><LinkButton href={`/admin/service-requests/${request.id}`} variant="ghost" className="min-h-8 px-3 text-xs">View</LinkButton><CopyButton value={request.id} label="Copy ID" /></div> }]} /></div>
      {data?.items.length === 0 && <EmptyState title="No service requests found" />}
      {data && <Pagination limit={limit} offset={offset} total={data.total} onPrevious={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />}
    </section>
  );
}

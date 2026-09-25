"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, AdminServiceRequest, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";

export default function AdminServiceRequestsPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-service-requests", offset], queryFn: () => apiFetch<AdminPage<AdminServiceRequest>>(`/api/v1/admin/service-requests?limit=${limit}&offset=${offset}`), enabled: hasToken });
  if (!hasToken) return <p className="rounded-3xl bg-red-50 p-5 text-red-800">Login with an admin account.</p>;
  if (isLoading) return <p className="rounded-3xl bg-white p-5 shadow-soft">Loading service requests...</p>;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">Service requests</h2>
      <div className="mt-5 grid gap-3">
        {data?.items.map((request) => <div key={request.id} className="rounded-2xl border border-gray-100 p-4"><p className="font-semibold">{request.status}</p><p className="text-sm text-gray-600">{request.category || "uncategorized"} · {request.location || "no location"}</p><p className="text-xs text-gray-400">External action: {String(request.external_action_executed)}</p></div>)}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button className="rounded-full border px-3 py-1 disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button><button className="rounded-full border px-3 py-1 disabled:opacity-40" disabled={!data || offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>Next</button></div>
    </section>
  );
}

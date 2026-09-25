"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminAuditLog, AdminPage, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";

export default function AdminAIPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-ai", offset], queryFn: () => apiFetch<AdminPage<AdminAuditLog>>(`/api/v1/admin/ai-events?limit=${limit}&offset=${offset}`), enabled: hasToken });
  if (!hasToken) return <p className="rounded-3xl bg-red-50 p-5 text-red-800">Login with an admin account.</p>;
  if (isLoading) return <p className="rounded-3xl bg-white p-5 shadow-soft">Loading AI events...</p>;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">AI observability</h2>
      <p className="mt-2 text-gray-600">Sanitized operational metadata only. No prompts, entities, API keys, or proposed task payloads.</p>
      <div className="mt-5 grid gap-3">
        {data?.items.map((event) => <pre key={event.id} className="overflow-x-auto rounded-2xl bg-mist p-4 text-xs">{JSON.stringify({ action: event.action, data: event.data, created_at: event.created_at }, null, 2)}</pre>)}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button className="rounded-full border px-3 py-1 disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button><button className="rounded-full border px-3 py-1 disabled:opacity-40" disabled={!data || offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>Next</button></div>
    </section>
  );
}

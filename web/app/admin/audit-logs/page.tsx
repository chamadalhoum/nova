"use client";

import { ChangeEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminAuditLog, AdminPage, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { Badge, Button, EmptyState, FilterBar, LoadingState, Pagination } from "@/components/ui";

type Filters = { q: string; action: string; user_id: string; start_at: string; end_at: string };
type FilterChangeEvent = ChangeEvent<HTMLInputElement>;
const empty: Filters = { q: "", action: "", user_id: "", start_at: "", end_at: "" };

export default function AdminAuditLogsPage() {
  const hasToken = Boolean(getAccessToken()); const [offset, setOffset] = useState(0); const [draft, setDraft] = useState<Filters>(empty); const [filters, setFilters] = useState<Filters>(empty); const limit = 50;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) }); Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-audit-logs", offset, filters], queryFn: () => apiFetch<AdminPage<AdminAuditLog>>(`/api/v1/admin/audit-logs?${params}`), enabled: hasToken, retry: false });
  const update = (key: keyof Filters, value: string) => setDraft((current) => ({ ...current, [key]: value })); const apply = () => { setFilters({ ...draft }); setOffset(0); }; const reset = () => { setDraft(empty); setFilters(empty); setOffset(0); };
  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />; if (isLoading) return <LoadingState label="Loading audit logs..." />; if (error) return <AdminError error={error} />;
  return <section className="rounded-[2rem] bg-white p-6 shadow-soft"><h2 className="text-3xl font-semibold">Audit logs</h2><div className="mt-5"><FilterBar><input aria-label="Search audit logs" className="min-h-11 rounded-2xl border px-3" placeholder="Search event" value={draft.q} onChange={(e: FilterChangeEvent) => update("q", e.target.value)} /><input aria-label="Audit action" className="min-h-11 rounded-2xl border px-3" placeholder="Action" value={draft.action} onChange={(e: FilterChangeEvent) => update("action", e.target.value)} /><input aria-label="Audit user ID" className="min-h-11 rounded-2xl border px-3" placeholder="User ID" value={draft.user_id} onChange={(e: FilterChangeEvent) => update("user_id", e.target.value)} /><input aria-label="Audit start date" className="min-h-11 rounded-2xl border px-3" type="datetime-local" value={draft.start_at} onChange={(e: FilterChangeEvent) => update("start_at", e.target.value)} /><input aria-label="Audit end date" className="min-h-11 rounded-2xl border px-3" type="datetime-local" value={draft.end_at} onChange={(e: FilterChangeEvent) => update("end_at", e.target.value)} /><Button onClick={apply}>Apply</Button><Button variant="secondary" onClick={reset}>Reset</Button></FilterBar></div><div className="mt-5 grid gap-3">{data?.items.map((event: AdminAuditLog) => <div key={event.id} className="rounded-2xl bg-mist p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Badge>{event.action}</Badge><span className="text-xs text-gray-500">{event.created_at}</span></div><p className="mt-2 text-xs text-gray-500">User: {event.user_id || "system"}</p>{Object.keys(event.data).length > 0 && <pre className="mt-3 overflow-x-auto text-xs text-gray-700">{JSON.stringify(event.data, null, 2)}</pre>}</div>)}</div>{data?.items.length === 0 && <EmptyState title="No audit logs found" />}{data && <Pagination limit={limit} offset={offset} total={data.total} onPrevious={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />}</section>;
}

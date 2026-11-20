"use client";

import { ChangeEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminAuditLog, AdminPage, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { Badge, Button, Card, EmptyState, FilterBar, LoadingState, Pagination } from "@/components/ui";

type Filters = { provider: string; model: string; intent: string; success: string; fallback: string; start_at: string; end_at: string };
type FilterChangeEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement>;
const empty: Filters = { provider: "", model: "", intent: "", success: "", fallback: "", start_at: "", end_at: "" };

export default function AdminAIPage() {
  const hasToken = Boolean(getAccessToken()); const [offset, setOffset] = useState(0); const [draft, setDraft] = useState<Filters>(empty); const [filters, setFilters] = useState<Filters>(empty); const limit = 50;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) }); Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-ai", offset, filters], queryFn: () => apiFetch<AdminPage<AdminAuditLog>>(`/api/v1/admin/ai-events?${params}`), enabled: hasToken, retry: false });
  const update = (key: keyof Filters, value: string) => setDraft((current) => ({ ...current, [key]: value })); const apply = () => { setFilters({ ...draft }); setOffset(0); }; const reset = () => { setDraft(empty); setFilters(empty); setOffset(0); };
  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />; if (isLoading) return <LoadingState label="Loading AI events..." />; if (error) return <AdminError error={error} />;
  return <Card><h2 className="text-3xl font-semibold">AI observability</h2><p className="mt-2 text-gray-600">Sanitized operational metadata only. No prompts, entities, API keys, or proposed task payloads.</p><div className="mt-5"><FilterBar><input aria-label="AI provider" className="min-h-11 rounded-2xl border px-3" placeholder="Provider" value={draft.provider} onChange={(e: FilterChangeEvent) => update("provider", e.target.value)} /><input aria-label="AI model" className="min-h-11 rounded-2xl border px-3" placeholder="Model" value={draft.model} onChange={(e: FilterChangeEvent) => update("model", e.target.value)} /><input aria-label="AI intent" className="min-h-11 rounded-2xl border px-3" placeholder="Intent" value={draft.intent} onChange={(e: FilterChangeEvent) => update("intent", e.target.value)} /><select aria-label="AI success" className="min-h-11 rounded-2xl border px-3" value={draft.success} onChange={(e: FilterChangeEvent) => update("success", e.target.value)}><option value="">Any success</option><option value="true">Success</option><option value="false">Failure</option></select><select aria-label="AI fallback" className="min-h-11 rounded-2xl border px-3" value={draft.fallback} onChange={(e: FilterChangeEvent) => update("fallback", e.target.value)}><option value="">Any fallback</option><option value="true">Fallback used</option><option value="false">No fallback</option></select><input aria-label="AI start date" className="min-h-11 rounded-2xl border px-3" type="datetime-local" value={draft.start_at} onChange={(e: FilterChangeEvent) => update("start_at", e.target.value)} /><input aria-label="AI end date" className="min-h-11 rounded-2xl border px-3" type="datetime-local" value={draft.end_at} onChange={(e: FilterChangeEvent) => update("end_at", e.target.value)} /><Button onClick={apply}>Apply</Button><Button variant="secondary" onClick={reset}>Reset</Button></FilterBar></div><div className="mt-5 grid gap-3">{data?.items.length === 0 && <EmptyState title="No AI events yet" />}{data?.items.map((event: AdminAuditLog) => <AIEvent key={event.id} event={event} />)}</div>{data && <Pagination limit={limit} offset={offset} total={data.total} onPrevious={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />}</Card>;
}

function AIEvent({ event }: { event: AdminAuditLog }) {
  const data = event.data as Record<string, unknown>;
  return <div className="rounded-2xl bg-mist p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Badge>{event.action}</Badge><span className="text-xs text-gray-500">{event.created_at}</span></div><div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-3"><p>Provider: {String(data.provider ?? "n/a")}</p>{data.model ? <p>Model: {String(data.model)}</p> : null}<p>Intent: {String(data.intent ?? "n/a")}</p><p>Latency: {String(data.latency_ms ?? "n/a")} ms</p><p>Success: {String(data.success ?? "n/a")}</p><p>Fallback: {String(data.fallback_used ?? "n/a")}</p>{data.error_type ? <p>Error: {String(data.error_type)}</p> : null}{typeof data.confidence === "number" ? <p>Confidence: {Math.round(data.confidence * 100)}%</p> : null}</div></div>;
}

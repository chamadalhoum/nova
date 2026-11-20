"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminServiceRequest, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../../admin-error";
import { EmptyState, LinkButton, LoadingState, StatusBadge } from "@/components/ui";

export default function AdminServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hasToken = Boolean(getAccessToken());
  const query = useQuery({ queryKey: ["admin-service-request", id], queryFn: () => apiFetch<AdminServiceRequest>(`/api/v1/admin/service-requests/${id}`), enabled: hasToken && Boolean(id), retry: false });
  if (!hasToken) return <EmptyState title="Admin login required" />;
  if (query.isLoading) return <LoadingState label="Loading service request..." />;
  if (query.error) return <AdminError error={query.error} />;
  if (!query.data) return <EmptyState title="Service request not found" />;
  const request = query.data;
  return <section className="space-y-5"><LinkButton href="/admin/service-requests" variant="secondary">Back to service requests</LinkButton><section className="rounded-[2rem] bg-white p-6 shadow-soft"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-calm">Service request details</p><h2 className="mt-2 text-3xl font-semibold">{request.category || "Uncategorized request"}</h2><div className="mt-4 flex gap-3"><StatusBadge status={request.status} /><span>{request.risk_level}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt>User</dt><dd>{request.user_id}</dd></div><div><dt>Location</dt><dd>{request.location || "Not specified"}</dd></div><div><dt>Created</dt><dd>{request.created_at}</dd></div><div><dt>Updated</dt><dd>{request.updated_at}</dd></div></dl><div className="mt-5 flex gap-2">{request.task_id && <LinkButton href={`/admin/tasks/${request.task_id}`} variant="secondary">Open task</LinkButton>}{request.provider_id && <LinkButton href={`/admin/providers/${request.provider_id}`} variant="secondary">Open provider</LinkButton>}</div><p className="mt-5 text-sm text-gray-600">Internal NOVA request only. No real booking, provider contact, or payment is connected.</p></section></section>;
}

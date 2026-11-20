"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "@/components/ui";

type ServiceRequest = { id: string; status: string; risk_level: string; data: { category?: string; location?: string; provider?: { name?: string } | null }; updated_at: string };

export default function ServiceRequestsPage() {
  const requests = useQuery({ queryKey: ["service-requests"], queryFn: () => apiFetch<ServiceRequest[]>("/api/v1/service-requests") });
  return <section className="grid gap-5"><PageHeader eyebrow="Services" title="Your service requests" description="Prepared requests remain internal until a connected booking capability exists." />{requests.isLoading && <LoadingState label="Loading service requests..." />}{requests.error && <ErrorState message={requests.error instanceof Error ? requests.error.message : "Could not load service requests."} />}{requests.data?.length === 0 && <EmptyState title="No service request yet" description="Select a provider from a task to prepare one." />}<div className="grid gap-4 md:grid-cols-2">{requests.data?.map((request) => <Card key={request.id}><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold capitalize">{request.data.category?.replaceAll("_", " ") || "Service request"}</h2><StatusBadge status={request.status} /></div><p className="mt-3 text-sm text-gray-600">{request.data.provider?.name || "No provider selected"}{request.data.location ? ` · ${request.data.location}` : ""}</p><p className="mt-2 text-xs text-gray-500">Updated {new Date(request.updated_at).toLocaleString()}</p></Card>)}</div></section>;
}

"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch, getAccessToken, ServiceDiscoveryResponse, ServiceRequest, Task } from "@/lib/api";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusBadge, Timeline, statusLabel } from "@/components/ui";

function nextStep(task: Task) {
  const terminalSteps: Record<string, string> = {
    COMPLETED: "No next step. This task is done.",
    CANCELLED: "No next step. This task was cancelled.",
  };
  if (terminalSteps[task.status]) return terminalSteps[task.status];
  const serviceRequest = task.data?.service_request as { status?: string } | undefined;
  if (serviceRequest?.status === "CONFIRMED") return "Request confirmed. Real provider booking is not connected yet.";
  if (serviceRequest?.status === "PREPARED") return "Service request prepared. Review and confirm it when ready.";
  if (task.data?.next_capability === "search_services") return "Search demo service options. Real booking is not connected yet.";
  const steps: Record<string, string> = {
    CONFIRMED: "Track this task or mark it complete when it is done.",
    IN_PROGRESS: "Finish the work, then mark it complete.",
    NEEDS_INFO: "Answer NOVA's question in chat.",
    WAITING_CONFIRMATION: "Confirm before NOVA creates the task.",
  };
  return steps[task.status] || "Review the task details.";
}

function formatValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "Not provided";
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const hasToken = Boolean(getAccessToken());
  const { data: task, error } = useQuery({ queryKey: ["task", params.id], queryFn: () => apiFetch<Task>(`/api/v1/tasks/${params.id}`), enabled: hasToken });
  const action = useMutation({
    mutationFn: (type: "complete" | "cancel") => apiFetch<Task>(`/api/v1/tasks/${params.id}/${type}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", params.id] }),
  });
  const serviceSearch = useMutation({
    mutationFn: () => apiFetch<ServiceDiscoveryResponse>(`/api/v1/tasks/${params.id}/search-services`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", params.id] }),
  });
  const selectProvider = useMutation({
    mutationFn: (providerId: string) => apiFetch<Task>(`/api/v1/tasks/${params.id}/select-provider`, { method: "POST", body: JSON.stringify({ provider_id: providerId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", params.id] });
      serviceSearch.reset();
    },
  });
  const confirmRequest = useMutation({
    mutationFn: (serviceRequestId: string) => apiFetch<ServiceRequest>(`/api/v1/service-requests/${serviceRequestId}/confirm`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task", params.id] }),
  });
  if (!hasToken || error) return <ErrorState title="Task not found or login required." message={error instanceof Error ? error.message : undefined} />;
  if (!task) return <LoadingState label="Preparing task details..." />;
  const selectedProvider = task.data?.selected_provider as { id?: string; name?: string; location?: string; is_demo?: boolean } | undefined;
  const serviceRequest = task.data?.service_request as { id?: string; status?: string; risk_level?: string } | undefined;
  const entities = task.data?.entities ?? {};
  const showServiceDiscovery = task.data?.next_capability === "search_services" || Boolean(serviceSearch.data);
  return (
    <section className="grid gap-5">
      <Card>
      <StatusBadge status={task.status} />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{task.title}</h1>
      <p className="mt-3 max-w-3xl text-gray-600">{task.description}</p>
      <div className="mt-5 grid gap-3 rounded-3xl bg-mist p-4 sm:grid-cols-3">
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Status</span>{statusLabel(task.status)}</p>
        {task.due_date && <p><span className="block text-xs uppercase tracking-wide text-gray-500">Date</span>{task.due_date}</p>}
        {entities.location && <p><span className="block text-xs uppercase tracking-wide text-gray-500">Area</span>{entities.location}</p>}
      </div>
      <div className="mt-4 rounded-3xl border border-calm/20 p-4">
        <p className="text-sm font-medium uppercase tracking-wide text-calm">Next</p>
        <p className="mt-1">{nextStep(task)}</p>
        {task.data?.next_capability === "search_services" && <p className="mt-2 text-sm text-gray-600">Demo service discovery available. NOVA will not contact or book a provider.</p>}
      </div>
      {selectedProvider && (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-sm font-medium uppercase tracking-wide">Provider</p>
          <p className="mt-1 text-xl font-semibold">{formatValue(selectedProvider.name)}</p>
          <p className="mt-1">Location: {formatValue(selectedProvider.location)}</p>
          <p className="mt-1">Demo provider: {selectedProvider.is_demo ? "Yes" : "No"}</p>
          {selectedProvider.id && <Link className="mt-3 inline-flex min-h-11 items-center rounded-full border border-amber-300 px-5" href={`/providers/${selectedProvider.id}`}>View details</Link>}
        </div>
      )}
      {serviceRequest && (
        <div className="mt-4 rounded-3xl border border-calm/20 p-4">
          <p className="text-sm font-medium uppercase tracking-wide text-calm">Service request</p>
          <p className="mt-1 text-lg font-semibold">{serviceRequest.status === "CONFIRMED" ? "Request confirmed" : "Service request prepared"}</p>
          <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <p>Service: {task.category.replaceAll("_", " ")}</p>
            <p>Provider: {formatValue(selectedProvider?.name)}</p>
            <p>Area: {formatValue(entities.location)}</p>
            <p>Date: {task.due_date || "Not provided"}</p>
          </div>
          <p className="mt-3 text-sm text-gray-600">Nothing has been booked. No external provider was contacted.</p>
          {serviceRequest.status === "PREPARED" && serviceRequest.id && (
            <div className="mt-4 rounded-2xl bg-mist p-4">
              <p className="font-medium">Before you continue</p>
              <p className="mt-2 text-sm text-gray-700">This confirms your internal NOVA request only. This is a demo provider and no real booking will be made.</p>
              <Button className="mt-3" onClick={() => confirmRequest.mutate(serviceRequest.id!)} disabled={confirmRequest.isPending}>{confirmRequest.isPending ? "Confirming request..." : "Confirm request"}</Button>
            </div>
          )}
          {serviceRequest.status === "CONFIRMED" && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm text-green-800">Your NOVA task is updated. Next step: real provider booking is not connected yet.</p>}
        </div>
      )}
      {showServiceDiscovery && (
        <div className="mt-4 rounded-3xl bg-amber-50 p-4 text-amber-950">
          <p className="font-medium">Service discovery foundation</p>
          <p className="mt-1 text-sm">Search demo options from the NOVA provider directory. Availability, ratings, prices and booking are not connected.</p>
          <Button className="mt-3" onClick={() => serviceSearch.mutate()} disabled={serviceSearch.isPending}>{serviceSearch.isPending ? "Searching options..." : "Search options"}</Button>
          {serviceSearch.data && <p className="mt-3 text-sm">{serviceSearch.data.message}</p>}
          {serviceSearch.data?.results.length === 0 && <p className="mt-3 rounded-2xl bg-white/70 p-3 text-sm">No demo providers found for this service and location. Your task is still saved.</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {serviceSearch.data?.results.map((provider) => (
              <article key={provider.id} className="rounded-3xl bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold">{provider.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{provider.description}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <p>Location: {provider.location}</p>
                  <p>Service: {provider.category.replaceAll("_", " ")}</p>
                  <p>Demo provider: {provider.is_demo ? "Yes" : "No"}</p>
                  <p>Availability: Not provided</p>
                  <p>Price: Not provided</p>
                </div>
                <p className="mt-3 text-xs text-gray-500">Demo information. Not real-time availability.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="min-h-11 rounded-full border px-4 py-3 text-sm" href={`/providers/${provider.id}`}>View details</Link>
                  <Button className="px-4" onClick={() => selectProvider.mutate(provider.id)} disabled={selectProvider.isPending}>{selectProvider.isPending ? "Preparing request..." : "Select"}</Button>
                </div>
              </article>
            ))}
          </div>
          {serviceSearch.error && <p className="mt-3 text-sm text-red-700">I could not load service options right now. Your task is still saved.</p>}
          {selectProvider.error && <p className="mt-3 text-sm text-red-700">I could not prepare this provider request. Your task is still saved.</p>}
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => action.mutate("complete")} disabled={action.isPending || ["COMPLETED", "CANCELLED"].includes(task.status)}>Complete</Button>
        <Button onClick={() => action.mutate("cancel")} variant="secondary" disabled={action.isPending || ["COMPLETED", "CANCELLED"].includes(task.status)}>Cancel</Button>
      </div>
      </Card>
      <Card>
      <h2 className="mt-8 text-xl font-semibold">Task history</h2>
      <div className="mt-4">{task.events.length ? <Timeline events={task.events} /> : <EmptyState title="No history yet" />}</div>
      </Card>
    </section>
  );
}

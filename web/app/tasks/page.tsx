"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, getAccessToken, Task } from "@/lib/api";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "NOVA is preparing this task",
    NEEDS_INFO: "NOVA needs one detail",
    PLANNED: "NOVA has a plan",
    WAITING_CONFIRMATION: "Review and confirm",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Done",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status.replaceAll("_", " ");
}

function nextLabel(task: Task) {
  const serviceRequest = task.data?.service_request as { status?: string } | undefined;
  if (serviceRequest?.status === "CONFIRMED") return "Request confirmed. Real booking is not connected yet.";
  if (serviceRequest?.status === "PREPARED") return "Service request prepared. Review and confirm it.";
  if (task.data?.next_capability === "search_services") return "Search demo service options.";
  return "Review the task details.";
}

export default function TasksPage() {
  const hasToken = Boolean(getAccessToken());
  const { data, isLoading, error } = useQuery({ queryKey: ["tasks"], queryFn: () => apiFetch<Task[]>("/api/v1/tasks"), enabled: hasToken });
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h1 className="text-3xl font-semibold">Tasks</h1>
      {isLoading && <p className="mt-4">Preparing your tasks...</p>}
      {(!hasToken || error) && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">Login first to view tasks.</p>}
      {data?.length === 0 && <p className="mt-6 rounded-3xl bg-mist p-6">No tasks yet. Tell NOVA what you need to get done.</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {data?.map((task) => (
          <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-3xl border border-gray-100 p-5 hover:border-calm">
            <span className="rounded-full bg-mist px-3 py-1 text-xs">{statusLabel(task.status)}</span>
            <h2 className="mt-3 text-xl font-semibold">{task.title}</h2>
            <p className="mt-2 text-gray-600">{task.description}</p>
            {task.due_date && <p className="mt-2 text-sm text-gray-500">Date: {task.due_date}</p>}
            {task.data?.entities?.location && <p className="mt-2 text-sm text-gray-500">Area: {task.data.entities.location}</p>}
            <p className="mt-3 text-sm font-medium text-ink">Next: {nextLabel(task)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, getAccessToken, Task } from "@/lib/api";
import { Card, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader, StatusBadge } from "@/components/ui";

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
  const groups = {
    active: data?.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status)) ?? [],
    done: data?.filter((task) => ["COMPLETED", "CANCELLED"].includes(task.status)) ?? [],
  };
  return (
    <section className="grid gap-5">
      <PageHeader eyebrow="Execution" title="Tasks" description="Your confirmed NOVA work, grouped by what still needs attention." action={<LinkButton href="/chat">Create from chat</LinkButton>} />
      {isLoading && <LoadingState label="Preparing your tasks..." />}
      {!hasToken && <ErrorState title="Login first to view tasks." />}
      {hasToken && error && <ErrorState message={error instanceof Error ? error.message : "Could not load tasks."} />}
      {data?.length === 0 && <EmptyState title="No tasks yet" description="Tell NOVA what you need to get done and confirm the task when it understands." action={<LinkButton href="/chat" variant="secondary">Start a request</LinkButton>} />}
      {groups.active.length > 0 && <TaskGroup title="Active work" tasks={groups.active} />}
      {groups.done.length > 0 && <TaskGroup title="Completed or cancelled" tasks={groups.done} muted />}
    </section>
  );
}

function TaskGroup({ title, tasks, muted = false }: { title: string; tasks: Task[]; muted?: boolean }) {
  return (
    <Card>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {tasks.map((task) => (
          <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-3xl border border-gray-100 p-5 transition hover:border-calm hover:bg-mist/40">
            <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={task.status} />{task.due_date && <span className="text-xs text-gray-500">{task.due_date}</span>}</div>
            <h3 className="mt-3 text-xl font-semibold">{task.title}</h3>
            <p className={muted ? "mt-2 text-sm text-gray-500" : "mt-2 text-sm text-gray-600"}>{task.description}</p>
            {task.data?.entities?.location && <p className="mt-2 text-sm text-gray-500">Area: {task.data.entities.location}</p>}
            <p className="mt-3 text-sm font-medium text-ink">Next: {nextLabel(task)}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

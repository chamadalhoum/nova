"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminTask, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../../admin-error";
import { EmptyState, LinkButton, LoadingState, StatusBadge, Timeline } from "@/components/ui";

export default function AdminTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hasToken = Boolean(getAccessToken());
  const query = useQuery({ queryKey: ["admin-task", id], queryFn: () => apiFetch<AdminTask>(`/api/v1/admin/tasks/${id}`), enabled: hasToken && Boolean(id), retry: false });
  if (!hasToken) return <EmptyState title="Admin login required" />;
  if (query.isLoading) return <LoadingState label="Loading task..." />;
  if (query.error) return <AdminError error={query.error} />;
  if (!query.data) return <EmptyState title="Task not found" />;
  const task = query.data;
  return <section className="space-y-5"><LinkButton href="/admin/tasks" variant="secondary">Back to tasks</LinkButton><section className="rounded-[2rem] bg-white p-6 shadow-soft"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-calm">Task details</p><h2 className="mt-2 text-3xl font-semibold">{task.title}</h2><div className="mt-4 flex gap-3"><StatusBadge status={task.status} /><span>{task.priority}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt>User</dt><dd>{task.user_id}</dd></div><div><dt>Category</dt><dd>{task.category}</dd></div><div><dt>Intent</dt><dd>{task.intent}</dd></div><div><dt>Due date</dt><dd>{task.due_date || "Not set"}</dd></div></dl>{task.description && <p className="mt-5 whitespace-pre-wrap text-sm text-gray-700">{task.description}</p>}</section><section className="rounded-[2rem] bg-white p-6 shadow-soft"><h3 className="text-xl font-semibold">Timeline</h3>{task.events?.length ? <div className="mt-4"><Timeline events={task.events.map((event: NonNullable<AdminTask["events"]>[number], index: number) => ({ id: `${event.event_type}-${index}`, ...event }))} /></div> : <div className="mt-4"><EmptyState title="No task events" /></div>}</section></section>;
}

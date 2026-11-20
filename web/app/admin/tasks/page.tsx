"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, AdminTask, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { CopyButton, DataTable, EmptyState, FilterBar, LinkButton, LoadingState, Pagination, StatusBadge } from "@/components/ui";

export default function AdminTasksPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const limit = 50;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set("status", status);
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-tasks", offset, status], queryFn: () => apiFetch<AdminPage<AdminTask>>(`/api/v1/admin/tasks?${params}`), enabled: hasToken });
  const tasks = (data?.items ?? []).filter((task: AdminTask) => [task.title, task.category, task.intent, task.user_id].join(" ").toLowerCase().includes(search.toLowerCase()));
  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />;
  if (isLoading) return <LoadingState label="Loading tasks..." />;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">Tasks</h2>
      <div className="mt-5"><FilterBar><input className="min-h-11 rounded-2xl border px-3" placeholder="Search current page" value={search} onChange={(event) => setSearch(event.target.value)} /><select className="min-h-11 rounded-2xl border px-3" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">All statuses</option>{["DRAFT", "NEEDS_INFO", "PLANNED", "SEARCHING", "WAITING_CONFIRMATION", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FilterBar></div>
      <div className="mt-5"><DataTable<AdminTask> rows={tasks} getKey={(task) => task.id} columns={[{ key: "task", header: "Task", render: (task) => <div><p className="font-medium text-ink">{task.title}</p><p className="text-xs text-gray-500">{task.intent} · {task.category}</p></div> }, { key: "status", header: "Status", render: (task) => <StatusBadge status={task.status} /> }, { key: "user", header: "User", render: (task) => <span className="text-xs text-gray-500">{task.user_id}</span> }, { key: "created", header: "Created", render: (task) => <span className="text-xs text-gray-500">{task.created_at}</span> }, { key: "actions", header: "Actions", render: (task) => <div className="flex gap-1"><LinkButton href={`/admin/tasks/${task.id}`} variant="ghost" className="min-h-8 px-3 text-xs">View</LinkButton><CopyButton value={task.id} label="Copy ID" /></div> }]} /></div>
      {tasks.length === 0 && <div className="mt-4"><EmptyState title="No tasks found" /></div>}
      {data && <Pagination limit={limit} offset={offset} total={data.total} onPrevious={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />}
    </section>
  );
}

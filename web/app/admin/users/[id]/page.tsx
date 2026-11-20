"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminError } from "../../admin-error";
import { AdminPage, AdminServiceRequest, AdminTask, AdminUser, apiFetch, getAccessToken } from "@/lib/api";
import { Badge, DataTable, EmptyState, LinkButton, LoadingState, Pagination } from "@/components/ui";

const PAGE_SIZE = 50;

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const hasToken = Boolean(getAccessToken());
  const enabled = hasToken && Boolean(userId);
  const [taskOffset, setTaskOffset] = useState(0);
  const [requestOffset, setRequestOffset] = useState(0);
  const user = useQuery({ queryKey: ["admin-user", userId], queryFn: () => apiFetch<AdminUser>(`/api/v1/admin/users/${userId}`), enabled, retry: false });
  const tasks = useQuery({ queryKey: ["admin-user-tasks", userId, taskOffset], queryFn: () => apiFetch<AdminPage<AdminTask>>(`/api/v1/admin/tasks?user_id=${encodeURIComponent(userId)}&limit=${PAGE_SIZE}&offset=${taskOffset}`), enabled });
  const requests = useQuery({ queryKey: ["admin-user-service-requests", userId, requestOffset], queryFn: () => apiFetch<AdminPage<AdminServiceRequest>>(`/api/v1/admin/service-requests?user_id=${encodeURIComponent(userId)}&limit=${PAGE_SIZE}&offset=${requestOffset}`), enabled });

  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />;
  if (user.isLoading) return <LoadingState label="Loading user..." />;
  if (user.error) return <AdminError error={user.error} />;
  if (!user.data) return <EmptyState title="User not found" />;

  const account = user.data;
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-[2rem] bg-white p-6 shadow-soft">
        <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-calm">User 360</p><h2 className="mt-2 text-3xl font-semibold">{account.full_name || "Unnamed user"}</h2><p className="mt-1 text-gray-600">{account.email}</p></div>
        <LinkButton href="/admin/users" variant="secondary">Back to users</LinkButton>
      </div>
      <section className="rounded-[2rem] bg-white p-6 shadow-soft"><h3 className="text-xl font-semibold">Account</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Detail label="User ID" value={account.id} /><Detail label="Email" value={account.email} /><Detail label="Created" value={account.created_at} /><Detail label="Last login" value={account.last_login_at || "Not available"} /><Detail label="Status" value={account.is_active ? "Active" : "Inactive"} /><Detail label="Role" value={account.role === "admin" ? "Admin — administration access" : "User — standard access"} /></dl></section>
      <ResourceSection title="Tasks" loading={tasks.isLoading} error={tasks.error} empty="No tasks for this user." rows={tasks.data?.items ?? []} total={tasks.data?.total ?? 0} offset={taskOffset} onPrevious={() => setTaskOffset(Math.max(0, taskOffset - PAGE_SIZE))} onNext={() => setTaskOffset(taskOffset + PAGE_SIZE)} table={<DataTable<AdminTask> rows={tasks.data?.items ?? []} getKey={(task) => task.id} columns={[{ key: "title", header: "Task", render: (task) => task.title }, { key: "status", header: "Status", render: (task) => <Badge>{task.status}</Badge> }, { key: "dates", header: "Dates", render: (task) => <span className="text-xs text-gray-500">Created {task.created_at}<br />Updated {task.updated_at}</span> }]} />} />
      <ResourceSection title="Service requests" loading={requests.isLoading} error={requests.error} empty="No service requests for this user." rows={requests.data?.items ?? []} total={requests.data?.total ?? 0} offset={requestOffset} onPrevious={() => setRequestOffset(Math.max(0, requestOffset - PAGE_SIZE))} onNext={() => setRequestOffset(requestOffset + PAGE_SIZE)} table={<DataTable<AdminServiceRequest> rows={requests.data?.items ?? []} getKey={(request) => request.id} columns={[{ key: "type", header: "Type", render: (request) => request.category || "Not specified" }, { key: "status", header: "Status", render: (request) => <Badge>{request.status}</Badge> }, { key: "dates", header: "Dates", render: (request) => <span className="text-xs text-gray-500">Created {request.created_at}<br />Updated {request.updated_at}</span> }]} />} />
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 break-words text-ink">{value}</dd></div>;
}

function ResourceSection({ title, loading, error, empty, rows, total, offset, onPrevious, onNext, table }: { title: string; loading: boolean; error: unknown; empty: string; rows: unknown[]; total: number; offset: number; onPrevious: () => void; onNext: () => void; table: React.ReactNode }) {
  return <section className="rounded-[2rem] bg-white p-6 shadow-soft"><h3 className="text-xl font-semibold">{title}</h3><div className="mt-4">{loading ? <LoadingState label={`Loading ${title.toLowerCase()}...`} /> : error ? <AdminError error={error} /> : rows.length === 0 ? <EmptyState title={empty} /> : <>{table}<Pagination limit={PAGE_SIZE} offset={offset} total={total} onPrevious={onPrevious} onNext={onNext} /></>}</div></section>;
}

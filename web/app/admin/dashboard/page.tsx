"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminAuditLog, AdminDashboard, AdminPage, AdminServiceRequest, AdminTask, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { Badge, Card, DataTable, EmptyState, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/ui";

const limit = 6;

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export default function AdminDashboardPage() {
  const hasToken = Boolean(getAccessToken());
  const dashboard = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => apiFetch<AdminDashboard>("/api/v1/admin/dashboard"), enabled: hasToken });
  const tasks = useQuery({ queryKey: ["admin-dashboard-tasks"], queryFn: () => apiFetch<AdminPage<AdminTask>>(`/api/v1/admin/tasks?limit=${limit}&offset=0`), enabled: hasToken });
  const requests = useQuery({ queryKey: ["admin-dashboard-service-requests"], queryFn: () => apiFetch<AdminPage<AdminServiceRequest>>(`/api/v1/admin/service-requests?limit=${limit}&offset=0`), enabled: hasToken });
  const intelligence = useQuery({ queryKey: ["admin-intelligence", 7], queryFn: () => apiFetch<{ ai: { total: number; success_rate: number | null; fallback_rate: number | null; average_latency_ms: number | null }; trends: Array<{ date: string; total: number; success_rate: number | null; fallback_rate: number | null; average_latency_ms: number | null }>; intentions: Array<{ intent: string; total: number }> }>("/api/v1/admin/intelligence?days=7"), enabled: hasToken });
  const auditLogs = useQuery({ queryKey: ["admin-dashboard-audit"], queryFn: () => apiFetch<AdminPage<AdminAuditLog>>(`/api/v1/admin/audit-logs?limit=${limit}&offset=0`), enabled: hasToken });

  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account to continue." />;
  if (dashboard.isLoading) return <LoadingState label="Loading admin dashboard..." />;
  if (dashboard.error) return <AdminError error={dashboard.error} />;
  if (!dashboard.data) return null;

  const confirmedTasks = dashboard.data.tasks_by_status.CONFIRMED ?? 0;

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow="Operations" title="NOVA admin dashboard" description="Real operational data from NOVA APIs. No bookings, payments, provider contact, prices, or availability are inferred." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Users" value={dashboard.data.total_users} hint={`${dashboard.data.users_created_recently} created recently`} />
        <StatCard label="Tasks" value={dashboard.data.total_tasks} hint={`${confirmedTasks} confirmed · ${dashboard.data.completed_tasks} completed`} />
        <StatCard label="Service requests" value={dashboard.data.service_requests} hint={`${dashboard.data.confirmed_service_requests} confirmed internally`} />
        <StatCard label="AI treatments" value={intelligence.data?.ai.total ?? "n/a"} hint="ai.intent_processed only" />
        <StatCard label="AI success rate" value={intelligence.data?.ai.success_rate == null ? "n/a" : formatPercent(intelligence.data.ai.success_rate)} hint={`Fallback ${intelligence.data?.ai.fallback_rate == null ? "n/a" : formatPercent(intelligence.data.ai.fallback_rate)}`} />
        <StatCard label="Provider selections" value={dashboard.data.provider_selections} hint="Demo provider selections only" />
      </div>

      <Card><h3 className="text-xl font-semibold">AI trends — last 7 days</h3>{intelligence.isLoading ? <div className="mt-4"><LoadingState label="Loading AI trends..." /></div> : intelligence.error ? <div className="mt-4"><AdminError error={intelligence.error} /></div> : intelligence.data?.trends.length ? <div className="mt-4 grid gap-2">{intelligence.data.trends.map((trend) => <div key={trend.date} className="flex flex-wrap justify-between gap-3 rounded-2xl bg-mist px-4 py-3 text-sm"><strong>{trend.date}</strong><span>{trend.total} treatments</span><span>Success {trend.success_rate == null ? "n/a" : formatPercent(trend.success_rate)}</span><span>Fallback {trend.fallback_rate == null ? "n/a" : formatPercent(trend.fallback_rate)}</span><span>Latency {trend.average_latency_ms == null ? "n/a" : `${Math.round(trend.average_latency_ms)} ms`}</span></div>)}</div> : <div className="mt-4"><EmptyState title="No AI treatments in this period" /></div>}</Card>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h3 className="text-xl font-semibold">Recent activity</h3>
          {auditLogs.isLoading && <div className="mt-4"><LoadingState label="Loading activity..." /></div>}
          {auditLogs.data?.items.length === 0 && <div className="mt-4"><EmptyState title="No activity yet" /></div>}
          <div className="mt-4 grid gap-3">
            {auditLogs.data?.items.map((event: AdminAuditLog) => <ActivityRow key={event.id} event={event} />)}
          </div>
        </Card>

        <Card>
          <h3 className="text-xl font-semibold">Tasks by status</h3>
          <div className="mt-4 grid gap-2">
            {(Object.entries(dashboard.data.tasks_by_status) as Array<[string, number]>).map(([status, count]) => <div key={status} className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3"><StatusBadge status={status} /><strong>{count}</strong></div>)}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h3 className="text-xl font-semibold">Latest tasks</h3>
          <div className="mt-4">
            <DataTable<AdminTask>
              rows={tasks.data?.items ?? []}
              getKey={(task) => task.id}
              columns={[
                { key: "task", header: "Task", render: (task) => <div><p className="font-medium text-ink">{task.title}</p><p className="text-xs text-gray-500">{task.category} · {task.intent}</p></div> },
                { key: "status", header: "Status", render: (task) => <StatusBadge status={task.status} /> },
                { key: "created", header: "Created", render: (task) => <span className="text-xs text-gray-500">{task.created_at}</span> },
              ]}
            />
          </div>
        </Card>

        <Card>
          <h3 className="text-xl font-semibold">Latest service requests</h3>
          <div className="mt-4">
            <DataTable<AdminServiceRequest>
              rows={requests.data?.items ?? []}
              getKey={(request) => request.id}
              columns={[
                { key: "request", header: "Request", render: (request) => <div><p className="font-medium text-ink">{request.category || "Uncategorized"}</p><p className="text-xs text-gray-500">{request.location || "No location"}</p></div> },
                { key: "status", header: "Status", render: (request) => <StatusBadge status={request.status} /> },
                { key: "created", header: "Created", render: (request) => <span className="text-xs text-gray-500">{request.created_at}</span> },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: AdminAuditLog }) {
  const isAIError = event.action.startsWith("ai.") && event.data.success === false;
  const isFallback = event.data.fallback_used === true;
  return (
    <div className="rounded-2xl bg-mist p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className={isAIError ? "bg-rose-100 text-rose-900" : isFallback ? "bg-amber-100 text-amber-900" : undefined}>{event.action}</Badge>
        <span className="text-xs text-gray-500">{event.created_at}</span>
      </div>
      <p className="mt-2 text-xs text-gray-500">Actor: {event.user_id || "system"}</p>
    </div>
  );
}

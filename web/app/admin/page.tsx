"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminDashboard, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "./admin-error";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-soft">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const hasToken = Boolean(getAccessToken());
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<AdminDashboard>("/api/v1/admin/dashboard"),
    enabled: hasToken,
  });

  if (!hasToken) return <p className="rounded-3xl bg-red-50 p-5 text-red-800">Login with an admin account to continue.</p>;
  if (isLoading) return <p className="rounded-3xl bg-white p-5 shadow-soft">Loading admin dashboard...</p>;
  if (error) return <AdminError error={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-5">
      <div className="rounded-[2rem] bg-white p-6 shadow-soft">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-calm">Operations</p>
        <h2 className="mt-2 text-3xl font-semibold text-ink">NOVA admin dashboard</h2>
        <p className="mt-2 text-gray-600">Real database metrics only. Unavailable metrics are explicitly listed.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Users" value={data.total_users} />
        <Metric label="Recent users" value={data.users_created_recently} />
        <Metric label="Tasks" value={data.total_tasks} />
        <Metric label="Completed tasks" value={data.completed_tasks} />
        <Metric label="Service requests" value={data.service_requests} />
        <Metric label="Confirmed requests" value={data.confirmed_service_requests} />
        <Metric label="Provider selections" value={data.provider_selections} />
        <Metric label="AI intent events" value={data.ai_intent_events} />
        <Metric label="Fallback events" value={data.fallback_events} />
      </div>
      <div className="rounded-[2rem] bg-white p-6 shadow-soft">
        <h3 className="text-xl font-semibold">Tasks by status</h3>
        <div className="mt-4 grid gap-2 text-sm">
          {Object.entries(data.tasks_by_status).map(([status, count]) => (
            <div key={status} className="flex justify-between rounded-2xl bg-mist px-4 py-3">
              <span>{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[2rem] bg-white p-6 shadow-soft">
        <h3 className="text-xl font-semibold">Unavailable metrics</h3>
        <p className="mt-2 text-gray-600">These are not shown as numbers because NOVA does not have real integrations for them yet.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.unavailable_metrics.map((metric) => <span key={metric} className="rounded-full bg-mist px-3 py-1 text-sm">{metric}</span>)}
        </div>
      </div>
    </div>
  );
}

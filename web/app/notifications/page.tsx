"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";

type Notification = { id: string; title: string; body: string; status: string; remind_at?: string | null; created_at?: string };

export default function NotificationsPage() {
  const { data, error, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => apiFetch<Notification[]>("/api/v1/notifications") });
  return (
    <section className="grid gap-5">
      <PageHeader eyebrow="Updates" title="Notifications" description="NOVA keeps this quiet unless something needs your attention." />
      <Card>
        {isLoading && <p className="text-sm text-gray-600">Loading notifications...</p>}
        {error && <ErrorState message="Login first to view reminders." />}
        {data?.length === 0 && <EmptyState title="No notifications" description="NOVA will only notify you when it is useful." />}
        <div className="grid gap-3">
          {data?.map((item) => <div key={item.id} className="rounded-2xl bg-mist p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{item.title}</p><span className="text-xs uppercase tracking-wide text-gray-500">{item.status}</span></div><p className="mt-1 text-gray-600">{item.body}</p>{item.remind_at && <p className="mt-2 text-xs text-gray-500">Reminder: {item.remind_at}</p>}</div>)}
        </div>
      </Card>
    </section>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type Notification = { id: string; title: string; body: string; status: string; remind_at?: string | null };

export default function NotificationsPage() {
  const { data, error } = useQuery({ queryKey: ["notifications"], queryFn: () => apiFetch<Notification[]>("/api/v1/notifications") });
  return <section className="rounded-[2rem] bg-white p-6 shadow-soft"><h1 className="text-3xl font-semibold">Notifications</h1>{error && <p className="mt-4">Login first to view reminders.</p>}{data?.length === 0 && <p className="mt-6 rounded-3xl bg-mist p-6">No reminders. NOVA will only notify you when it is useful.</p>}{data?.map((item) => <div key={item.id} className="mt-4 rounded-2xl bg-mist p-4"><p className="font-medium">{item.title}</p><p className="text-gray-600">{item.body}</p></div>)}</section>;
}

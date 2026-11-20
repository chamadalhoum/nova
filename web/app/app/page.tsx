"use client";

import Link from "next/link";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, Task } from "@/lib/api";
import { Card, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/ui";

type User = { full_name: string | null; email: string };
type Conversation = { id: string; title: string; state: string; updated_at: string };
type ServiceRequest = { id: string; status: string; data: { category?: string; provider?: { name?: string } | null }; updated_at: string };

export default function HomePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<User>("/api/v1/me") });
  const tasks = useQuery({ queryKey: ["home-tasks"], queryFn: () => apiFetch<Task[]>("/api/v1/tasks") });
  const requests = useQuery({ queryKey: ["home-service-requests"], queryFn: () => apiFetch<ServiceRequest[]>("/api/v1/service-requests") });
  const conversations = useQuery({ queryKey: ["home-conversations"], queryFn: () => apiFetch<Conversation[]>("/api/v1/conversations") });
  const hasError = [me, tasks, requests, conversations].some((query) => query.error);
  const loading = [me, tasks, requests, conversations].some((query) => query.isLoading);
  const allTasks = tasks.data ?? [];
  const activeTasks = allTasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status));
  const completedTasks = allTasks.filter((task) => task.status === "COMPLETED");
  const actionTasks = allTasks.filter((task) => ["NEEDS_INFO", "WAITING_CONFIRMATION"].includes(task.status));
  const allRequests = requests.data ?? [];
  const pendingRequests = allRequests.filter((request) => request.status === "PREPARED");
  const confirmedRequests = allRequests.filter((request) => request.status === "CONFIRMED");
  const displayName = me.data?.full_name || me.data?.email || "there";

  return <section className="grid gap-6">
    <PageHeader eyebrow="Your NOVA workspace" title={`Welcome, ${displayName}`} description="See what needs your attention and continue where you left off." action={<LinkButton href="/chat">Ask NOVA</LinkButton>} />
    {loading && <LoadingState label="Loading your workspace..." />}
    {hasError && <ErrorState title="Your workspace could not be loaded." message="Check your connection, then refresh the page." />}
    {!loading && !hasError && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="All tasks" value={allTasks.length} /><StatCard label="In progress" value={activeTasks.length} /><StatCard label="Completed" value={completedTasks.length} /><StatCard label="Need your action" value={actionTasks.length} hint="Missing information or confirmation" /></section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-calm">Tasks</p><h2 className="mt-1 text-2xl font-semibold">Your work</h2></div><LinkButton href="/tasks" variant="ghost">All tasks</LinkButton></div>{allTasks.length === 0 ? <div className="mt-5"><EmptyState title="No tasks yet" description="Start a conversation and NOVA will prepare a task for you to confirm." action={<LinkButton href="/chat" variant="secondary">Start with NOVA</LinkButton>} /></div> : <div className="mt-5 grid gap-3">{allTasks.slice(0, 3).map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-2xl bg-mist p-4 transition hover:bg-gray-100"><div className="flex justify-between gap-3"><p className="font-semibold">{task.title}</p><StatusBadge status={task.status} /></div><p className="mt-2 text-sm text-gray-600">{task.description || "No description"}</p></Link>)}</div>}</Card>
        <Card><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-calm">Service requests</p><h2 className="mt-1 text-2xl font-semibold">Your requests</h2></div><LinkButton href="/service-requests" variant="ghost">All requests</LinkButton></div><div className="mt-5 grid grid-cols-2 gap-3"><StatCard label="Prepared" value={pendingRequests.length} /><StatCard label="Confirmed" value={confirmedRequests.length} /></div>{allRequests.length === 0 && <div className="mt-4"><EmptyState title="No service request" description="Requests appear once you select a provider for a task." /></div>}</Card>
      </section>
      <section className="grid gap-6 lg:grid-cols-2"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Conversations</h2><LinkButton href="/conversations" variant="ghost">All conversations</LinkButton></div>{(conversations.data?.length ?? 0) === 0 ? <div className="mt-5"><EmptyState title="No conversation yet" description="Ask NOVA for help to begin." action={<LinkButton href="/chat" variant="secondary">Open assistant</LinkButton>} /></div> : <div className="mt-5 grid gap-3">{conversations.data?.slice(0, 3).map((conversation) => <Link key={conversation.id} href={`/chat?conversation=${conversation.id}`} className="rounded-2xl bg-mist p-4"><p className="font-semibold">{conversation.title}</p><p className="mt-1 text-sm text-gray-600">Last activity: {new Date(conversation.updated_at).toLocaleString()}</p></Link>)}</div>}</Card><Card><h2 className="text-2xl font-semibold">Recent activity</h2><p className="mt-2 text-sm text-gray-600">Your latest real task and request updates.</p><div className="mt-5 grid gap-3">{[...allTasks.slice(0, 2).map((task) => ({ id: task.id, title: task.title, status: task.status })), ...allRequests.slice(0, 2).map((request) => ({ id: request.id, title: request.data.category || "Service request", status: request.status }))].map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-mist p-4"><p className="font-medium capitalize">{item.title.replaceAll("_", " ")}</p><StatusBadge status={item.status} /></div>)}{allTasks.length === 0 && allRequests.length === 0 && <EmptyState title="No activity yet" description="Your confirmed work and service updates will appear here." />}</div></Card></section>
    </>}
  </section>;
}

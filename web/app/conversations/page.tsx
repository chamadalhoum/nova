"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader } from "@/components/ui";

type Conversation = { id: string; title: string; state: string; updated_at: string };

export default function ConversationsPage() {
  const conversations = useQuery({ queryKey: ["conversations"], queryFn: () => apiFetch<Conversation[]>("/api/v1/conversations") });
  return <section className="grid gap-5"><PageHeader eyebrow="Assistant NOVA" title="Your conversations" description="Resume a request or start a new one." action={<LinkButton href="/chat">New conversation</LinkButton>} />{conversations.isLoading && <LoadingState label="Loading conversations..." />}{conversations.error && <ErrorState message={conversations.error instanceof Error ? conversations.error.message : "Could not load conversations."} />}{conversations.data?.length === 0 && <EmptyState title="No conversations yet" description="NOVA is ready when you are." action={<LinkButton href="/chat" variant="secondary">Open assistant</LinkButton>} />}<div className="grid gap-3">{conversations.data?.map((conversation) => <Card key={conversation.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{conversation.title}</h2><p className="mt-1 text-sm text-gray-600">Last activity: {new Date(conversation.updated_at).toLocaleString()}</p></div><Link href={`/chat?conversation=${conversation.id}`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Resume</Link></div></Card>)}</div></section>;
}

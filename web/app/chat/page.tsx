"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import React, { FormEvent, useState } from "react";
import { apiFetch, Task } from "@/lib/api";

type Conversation = { id: string; title: string };
type AIResponse = {
  state: string;
  assistant_message: { content: string; data: Record<string, unknown> };
  proposed_task?: { title: string; category: string; due_date?: string; location?: string; next_action?: string; suggested_capability?: string };
};

function categoryLabel(category?: string) {
  return (category || "task").replaceAll("_", " ");
}

export default function ChatPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [latestAIResponse, setLatestAIResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const active = conversation ?? await apiFetch<Conversation>("/api/v1/conversations", { method: "POST", body: JSON.stringify({}) });
      setConversation(active);
      return apiFetch<AIResponse>(`/api/v1/conversations/${active.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: (data, content) => {
      setMessages((current) => [...current, { role: "user", content }, { role: "assistant", content: data.assistant_message.content }]);
      setLatestAIResponse(data);
      setCreatedTask(null);
      setInput("");
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong."),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("No conversation is ready.");
      return apiFetch<Task>(`/api/v1/conversations/${conversation.id}/confirm-task`, { method: "POST" });
    },
    onSuccess: (task) => {
      setCreatedTask(task);
      setLatestAIResponse(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create task."),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    send.mutate(input.trim());
  }

  const waitingConfirmation = latestAIResponse?.state === "waiting_confirmation" && Boolean(latestAIResponse.proposed_task);

  return (
    <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-5 shadow-soft sm:p-8">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-calm">NOVA</p>
      <h1 className="mt-3 text-3xl font-semibold">What can I help you get done?</h1>
      <div className="mt-6 min-h-72 space-y-3 rounded-3xl bg-mist p-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-gray-600">Write naturally, use voice later, or attach a photo when image providers are configured.</p>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "user" ? "text-right" : "text-left"}>
              <span className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-ink text-white" : "bg-white text-ink"}`}>
                {message.content}
              </span>
            </div>
          ))
        )}
        {send.isPending && <p className="text-sm text-gray-600">Understanding your request...</p>}
      </div>
      {waitingConfirmation && !createdTask && (
        <div className="mt-4 rounded-3xl border border-calm/20 bg-calm/10 p-4">
          <p className="font-medium">I understand:</p>
          {latestAIResponse?.proposed_task && (
            <div className="mt-3 space-y-1 text-sm text-gray-800">
              <p>Service: {categoryLabel(latestAIResponse.proposed_task.category)}</p>
              {latestAIResponse.proposed_task.location && <p>Area: {latestAIResponse.proposed_task.location}</p>}
              {latestAIResponse.proposed_task.due_date && <p>Date: {latestAIResponse.proposed_task.due_date}</p>}
              {latestAIResponse.proposed_task.suggested_capability === "search_services" && <p>I can search the service options available in NOVA.</p>}
              <p>No booking or provider contact will happen yet.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => confirm.mutate()} className="min-h-11 rounded-full bg-ink px-5 text-white" disabled={confirm.isPending}>
              {confirm.isPending ? "Preparing your task..." : latestAIResponse?.proposed_task?.suggested_capability === "search_services" ? "Create task, then search options" : "Confirm and create task"}
            </button>
            <button onClick={() => setLatestAIResponse(null)} className="min-h-11 rounded-full border px-5" type="button">Modify</button>
          </div>
        </div>
      )}
      {createdTask && <div className="mt-4 rounded-2xl bg-green-50 p-4 text-green-800"><p>Task created: {createdTask.title}</p><Link className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-white" href={`/tasks/${createdTask.id}`}>Open task and search options</Link></div>}
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">{error}</p>}
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-12 flex-1 rounded-full border border-gray-200 px-5 outline-none focus:border-calm"
          placeholder="Write what you need..."
          aria-label="Write what you need"
        />
        <button className="min-h-12 rounded-full bg-ink px-6 font-medium text-white" disabled={send.isPending}>Send</button>
      </form>
      <div className="mt-4 flex gap-3 text-sm text-gray-600">
        <button className="min-h-11 rounded-full border px-4" type="button">Microphone</button>
        <button className="min-h-11 rounded-full border px-4" type="button">Camera</button>
      </div>
    </section>
  );
}

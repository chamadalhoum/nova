"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, clearTokens, getAccessToken } from "@/lib/api";

type User = { email: string; full_name?: string | null; locale: string; timezone: string };
type Memory = { id: string; type: string; key: string; value: string };

function memoryLabel(memory: Memory) {
  const labels: Record<string, string> = {
    language: "Preferred language",
    preferred_language: "Preferred language",
    location: "Preferred area",
    preferred_location: "Preferred area",
  };
  return labels[memory.key] || memory.key.replaceAll("_", " ");
}

export default function ProfilePage() {
  const hasToken = Boolean(getAccessToken());
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<User>("/api/v1/me"), enabled: hasToken });
  const memories = useQuery({ queryKey: ["memories"], queryFn: () => apiFetch<Memory[]>("/api/v1/memories"), enabled: hasToken });
  const [key, setKey] = useState("language");
  const [value, setValue] = useState("fr");

  async function addMemory(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/v1/memories", { method: "POST", body: JSON.stringify({ type: "user_preference", key, value }) });
    memories.refetch();
  }

  return <section className="grid gap-6 lg:grid-cols-2"><div className="min-w-0 rounded-[2rem] bg-white p-6 shadow-soft"><h1 className="text-3xl font-semibold">Profile</h1>{me.data ? <p className="mt-4 break-words">{me.data.email}</p> : <p className="mt-4">Login to view your profile.</p>}<button onClick={clearTokens} className="mt-5 min-h-11 rounded-full border px-5">Logout locally</button></div><div className="min-w-0 rounded-[2rem] bg-white p-6 shadow-soft"><h2 className="text-2xl font-semibold">What NOVA remembers</h2><p className="mt-2 text-sm text-gray-600">Saved preferences are controlled by you. NOVA does not automatically store every conversation.</p><form onSubmit={addMemory} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><input aria-label="Memory key" className="min-h-11 min-w-0 rounded-2xl border px-3" value={key} onChange={(e) => setKey(e.target.value)} /><input aria-label="Memory value" className="min-h-11 min-w-0 rounded-2xl border px-3" value={value} onChange={(e) => setValue(e.target.value)} /><button className="min-h-11 rounded-full bg-ink px-4 text-white">Save</button></form>{memories.data?.length === 0 && <p className="mt-4 rounded-2xl bg-mist p-3">NOVA has no saved preferences yet.</p>}{memories.data?.map((memory) => <p key={memory.id} className="mt-3 rounded-2xl bg-mist p-3">{memoryLabel(memory)}: {memory.value}</p>)}</div></section>;
}

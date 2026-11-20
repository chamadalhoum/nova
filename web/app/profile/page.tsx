"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, getAccessToken, logout } from "@/lib/api";
import { Button, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";

type User = { email: string; full_name?: string | null; locale: string; timezone: string; created_at: string };
type Memory = { id: string; type: string; key: string; value: string };

function memoryLabel(memory: Memory) {
  const labels: Record<string, string> = { language: "Preferred language", preferred_language: "Preferred language", location: "Preferred area", preferred_location: "Preferred area" };
  return labels[memory.key] || memory.key.replaceAll("_", " ");
}

export default function ProfilePage() {
  const router = useRouter();
  const hasToken = Boolean(getAccessToken());
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<User>("/api/v1/me"), enabled: hasToken });
  const memories = useQuery({ queryKey: ["memories"], queryFn: () => apiFetch<Memory[]>("/api/v1/memories"), enabled: hasToken });
  const [key, setKey] = useState("language");
  const [value, setValue] = useState("fr");
  const [message, setMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [locale, setLocale] = useState("en");
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (!me.data) return;
    setFullName(me.data.full_name || "");
    setLocale(me.data.locale);
    setTimezone(me.data.timezone);
  }, [me.data]);

  async function addMemory(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/v1/memories", { method: "POST", body: JSON.stringify({ type: "user_preference", key, value }) });
    setMessage("Saved preference.");
    memories.refetch();
  }

  async function updateProfile(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/api/v1/me", { method: "PATCH", body: JSON.stringify({ full_name: fullName, locale, timezone }) });
      setMessage("Profile updated.");
      me.refetch();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update profile."); }
  }

  return (
    <section className="grid gap-5">
      <PageHeader eyebrow="Account" title="Profile and privacy" description="Control your saved preferences and local session. Temporary conversation context is separate from saved memory." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-semibold">Account</h2>
          {me.data ? <><div className="mt-4 space-y-2 text-sm"><p className="break-words font-medium">{me.data.email}</p><p>Account created: {new Date(me.data.created_at).toLocaleDateString()}</p></div><form onSubmit={updateProfile} className="mt-4 grid gap-3"><label className="text-sm font-medium" htmlFor="profile-name">Name<input id="profile-name" className="mt-1 min-h-11 w-full rounded-2xl border px-3" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label className="text-sm font-medium" htmlFor="profile-locale">Locale<input id="profile-locale" className="mt-1 min-h-11 w-full rounded-2xl border px-3" value={locale} onChange={(event) => setLocale(event.target.value)} required /></label><label className="text-sm font-medium" htmlFor="profile-timezone">Timezone<input id="profile-timezone" className="mt-1 min-h-11 w-full rounded-2xl border px-3" value={timezone} onChange={(event) => setTimezone(event.target.value)} required /></label><Button>Save profile</Button></form></> : <p className="mt-4 text-gray-600">Login to view your profile.</p>}
          <Button onClick={async () => { await logout(); router.replace("/login"); }} variant="secondary" className="mt-5">Logout</Button>
        </Card>
        <Card>
          <h2 className="text-2xl font-semibold">What NOVA remembers</h2>
          <p className="mt-2 text-sm text-gray-600">Saved preferences are controlled by you. NOVA does not automatically store every conversation.</p>
          <form onSubmit={addMemory} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input aria-label="Memory key" className="min-h-11 min-w-0 rounded-2xl border px-3 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={key} onChange={(e) => setKey(e.target.value)} />
            <input aria-label="Memory value" className="min-h-11 min-w-0 rounded-2xl border px-3 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={value} onChange={(e) => setValue(e.target.value)} />
            <Button>Save</Button>
          </form>
          {message && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
          {memories.error && <div className="mt-4"><ErrorState message="Login first to view saved memory." /></div>}
          {memories.data?.length === 0 && <div className="mt-4"><EmptyState title="No saved preferences yet" description="You decide what NOVA remembers long term." /></div>}
          {memories.data?.map((memory) => <p key={memory.id} className="mt-3 rounded-2xl bg-mist p-3 text-sm"><span className="font-medium">{memoryLabel(memory)}:</span> {memory.value}</p>)}
        </Card>
      </div>
    </section>
  );
}

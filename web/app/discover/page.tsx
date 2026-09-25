"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch, Capability, Provider } from "@/lib/api";

type Category = { id: string; slug: string; name: string; description: string };
export default function DiscoverPage() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiFetch<Category[]>("/api/v1/service-categories") });
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => apiFetch<Provider[]>("/api/v1/providers") });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: () => apiFetch<Capability[]>("/api/v1/capabilities") });
  const activeCapabilities = capabilities.data?.filter((capability) => capability.enabled) ?? [];
  const comingSoon = capabilities.data?.filter((capability) => !capability.enabled) ?? [];
  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-[2rem] bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-semibold">Discover</h1>
        <p className="mt-2 text-gray-600">See what NOVA can actually help with today.</p>
        <div className="mt-5 rounded-3xl bg-mist p-4">
          <h2 className="font-semibold">Available now</h2>
          {activeCapabilities.length === 0 ? <p className="mt-3 text-sm text-gray-600">Choose something NOVA can help you with.</p> : <div className="mt-3 space-y-2 text-sm text-gray-700">{activeCapabilities.map((capability) => <p key={capability.name}>✓ {capability.description}</p>)}</div>}
        </div>
        <h2 className="mt-6 text-xl font-semibold">What can NOVA help with?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border p-4"><p className="font-semibold">Home</p><p className="mt-2 text-sm text-gray-600">🔧 Plumbing<br />❄️ Air conditioning<br />⚡ Electricity<br />🧹 Cleaning<br />🔧 Appliance repair<br />🏠 Home maintenance</p></div>
          <div className="rounded-3xl border p-4"><p className="font-semibold">Planning</p><p className="mt-2 text-sm text-gray-600">📅 Appointments<br />📝 Tasks<br />⏰ Reminders<br />🧠 Controlled memory<br />📁 Assets</p></div>
          <div className="rounded-3xl border border-dashed p-4 sm:col-span-2"><p className="font-semibold">Coming soon</p><p className="mt-2 text-sm text-gray-600">🛒 Shopping · ✈️ Travel · 💳 Payments · 📦 Real booking · Provider onboarding</p><div className="mt-3 space-y-1 text-sm text-gray-500">{comingSoon.map((capability) => <p key={capability.name}>Coming soon: {capability.description}</p>)}</div></div>
        </div>
        <div className="mt-5 space-y-3">
          {categories.data?.map((category) => <div key={category.id} className="rounded-2xl bg-mist p-4"><p className="font-medium">{category.name}</p><p className="text-sm text-gray-600">{category.description}</p></div>)}
        </div>
      </div>
      <div className="rounded-[2rem] bg-white p-6 shadow-soft">
        <h2 className="text-2xl font-semibold">Providers</h2>
        <p className="mt-2 text-sm text-gray-600">Demo providers are explicitly marked. NOVA does not have live availability, prices or booking confirmations yet.</p>
        <div className="mt-5 grid gap-4">
          {providers.data?.map((provider) => <div key={provider.id} className="rounded-3xl border p-5"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">Demo provider</span><h3 className="mt-3 text-xl font-semibold">{provider.name}</h3><p className="mt-2 text-gray-600">{provider.description}</p><p className="mt-2 text-sm">Location: {provider.location || "Not provided"}</p><p className="mt-2 text-sm">Services: {provider.services.length ? provider.services.join(", ") : "Not provided"}</p><p className="mt-2 text-xs text-gray-500">Demo information — not real-time availability, price, rating, review, or booking.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-full border px-5 text-sm" href={`/providers/${provider.id}`}>View details</Link></div>)}
        </div>
      </div>
    </section>
  );
}

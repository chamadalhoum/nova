"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, Capability, Provider } from "@/lib/api";
import { Badge, Card, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader } from "@/components/ui";

type Category = { id: string; slug: string; name: string; description: string };

export default function DiscoverPage() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiFetch<Category[]>("/api/v1/service-categories") });
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => apiFetch<Provider[]>("/api/v1/providers") });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: () => apiFetch<Capability[]>("/api/v1/capabilities") });
  const activeCapabilities = capabilities.data?.filter((capability) => capability.enabled) ?? [];
  const comingSoon = capabilities.data?.filter((capability) => !capability.enabled) ?? [];

  return (
    <section className="grid gap-6">
      <PageHeader eyebrow="Capabilities" title="Discover what NOVA can safely do" description="Everything here reflects backend capabilities and demo provider data. Real booking, live availability and payments are not connected." />
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-6">
          <Card>
            <h2 className="text-xl font-semibold">Available now</h2>
            {capabilities.isLoading && <LoadingState label="Loading capabilities..." />}
            {activeCapabilities.length === 0 && !capabilities.isLoading ? <EmptyState title="No capabilities loaded" description="Try again once the backend is available." /> : <div className="mt-4 grid gap-3 text-sm text-gray-700">{activeCapabilities.map((capability) => <div key={capability.name} className="rounded-2xl bg-mist p-3"><Badge>{capability.risk_level}</Badge><p className="mt-2">{capability.description}</p></div>)}</div>}
          </Card>
          <Card>
            <h2 className="text-xl font-semibold">Service categories</h2>
            {categories.error && <ErrorState message="Could not load service categories." />}
            <div className="mt-4 grid gap-3">
              {categories.data?.map((category) => <div key={category.id} className="rounded-2xl bg-mist p-4"><p className="font-medium">{category.name}</p><p className="mt-1 text-sm text-gray-600">{category.description}</p></div>)}
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-semibold">Not connected yet</h2>
            <p className="mt-2 text-sm text-gray-600">NOVA can prepare internal tasks and demo requests. It does not contact providers or take payment.</p>
            <div className="mt-4 flex flex-wrap gap-2">{comingSoon.map((capability) => <Badge key={capability.name} className="bg-amber-100 text-amber-900">{capability.name.replaceAll("_", " ")}</Badge>)}</div>
          </Card>
        </div>
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-2xl font-semibold">Demo providers</h2><p className="mt-2 text-sm text-gray-600">Shown exactly as available in NOVA. No prices, reviews, phone numbers, or live availability are invented.</p></div>
          </div>
          {providers.isLoading && <div className="mt-5"><LoadingState label="Loading providers..." /></div>}
          {providers.error && <div className="mt-5"><ErrorState message="Could not load providers." /></div>}
          <div className="mt-5 grid gap-4">
            {providers.data?.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
          </div>
        </Card>
      </div>
    </section>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <article className="rounded-3xl border border-gray-100 p-5 transition hover:border-calm hover:bg-mist/30">
      <Badge className={provider.is_demo ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}>{provider.is_demo ? "Demo provider" : "Provider"}</Badge>
      <h3 className="mt-3 text-xl font-semibold">{provider.name}</h3>
      {provider.description && <p className="mt-2 text-gray-600">{provider.description}</p>}
      <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <p>Area: {provider.location}</p>
        {provider.services.length > 0 && <p>Services: {provider.services.join(", ")}</p>}
      </div>
      <p className="mt-3 text-xs text-gray-500">Demo information only. No real-time availability, price, rating, review, or booking is connected.</p>
      <LinkButton className="mt-4" href={`/providers/${provider.id}`} variant="secondary">View details</LinkButton>
    </article>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, Provider } from "@/lib/api";
import { Badge, Card, ErrorState, LoadingState, PageHeader } from "@/components/ui";

function value(text?: string | null) {
  return text && text.trim() ? text : "Not provided";
}

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: provider, error, isLoading } = useQuery({
    queryKey: ["provider", params.id],
    queryFn: () => apiFetch<Provider>(`/api/v1/providers/${params.id}`),
  });

  if (isLoading) return <LoadingState label="Loading provider details..." />;
  if (error || !provider) return <ErrorState message="I could not load this provider right now." />;

  return (
    <section className="mx-auto grid max-w-3xl gap-5">
      <PageHeader eyebrow={provider.is_demo ? "Demo provider" : "Provider"} title={provider.name} description={value(provider.description)} />
      <Card>
        <div className="grid gap-3 rounded-3xl bg-mist p-4 sm:grid-cols-2">
          <p><span className="block text-xs uppercase tracking-wide text-gray-500">Area</span>{value(provider.location)}</p>
          <p><span className="block text-xs uppercase tracking-wide text-gray-500">Demo status</span>{provider.is_demo ? "Demo data" : "Provider data"}</p>
        </div>
        <h2 className="mt-6 text-xl font-semibold">Services</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {provider.services.length > 0 ? provider.services.map((service: Provider["services"][number]) => <Badge key={service}>{service}</Badge>) : <span className="text-sm text-gray-600">No services listed.</span>}
        </div>
        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">Demo information only. NOVA does not have real-time availability, prices, reviews, external contact, or booking for this provider.</p>
      </Card>
    </section>
  );
}

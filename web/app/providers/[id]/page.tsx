"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, Provider } from "@/lib/api";

function value(text?: string | null) {
  return text && text.trim() ? text : "Not provided";
}

export default function ProviderDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: provider, error, isLoading } = useQuery({
    queryKey: ["provider", params.id],
    queryFn: () => apiFetch<Provider>(`/api/v1/providers/${params.id}`),
  });

  if (isLoading) return <p className="rounded-3xl bg-white p-6 shadow-soft">Loading provider details...</p>;
  if (error || !provider) return <p className="rounded-2xl bg-red-50 p-4 text-red-800">I could not load this provider right now.</p>;

  return (
    <section className="mx-auto max-w-3xl rounded-[2rem] bg-white p-6 shadow-soft">
      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">{provider.is_demo ? "Demo provider" : "Provider"}</span>
      <h1 className="mt-4 text-3xl font-semibold">{provider.name}</h1>
      <p className="mt-3 text-gray-600">{value(provider.description)}</p>
      <div className="mt-6 grid gap-3 rounded-3xl bg-mist p-4 sm:grid-cols-2">
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Location</span>{value(provider.location)}</p>
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Demo status</span>{provider.is_demo ? "Demo data" : "Not demo"}</p>
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Availability</span>Not provided</p>
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Price</span>Not provided</p>
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Rating</span>{provider.rating === null ? "Not provided" : provider.rating}</p>
        <p><span className="block text-xs uppercase tracking-wide text-gray-500">Reviews</span>{provider.review_count === null ? "Not provided" : provider.review_count}</p>
      </div>
      <h2 className="mt-6 text-xl font-semibold">Services</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {provider.services.length > 0 ? provider.services.map((service) => <span key={service} className="rounded-full bg-mist px-4 py-2 text-sm">{service}</span>) : <span>Not provided</span>}
      </div>
      <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">Demo information only. NOVA does not have real-time availability, prices, reviews, external contact, or booking for this provider.</p>
    </section>
  );
}

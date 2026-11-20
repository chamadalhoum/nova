"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";

type Asset = { id: string; name: string; type: string; brand?: string | null; model?: string | null; notes?: string | null };

export default function PassportPage() {
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/api/v1/assets") });
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/v1/assets", { method: "POST", body: JSON.stringify({ name, type: "appliance", brand: brand || null }) });
      setName("");
      setBrand("");
      assets.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add asset.");
    }
  }

  return (
    <section className="grid gap-5">
      <PageHeader eyebrow="Home Passport" title="Useful long-term context" description="Save durable information you control, such as important home assets. NOVA does not automatically store every conversation." />
      <Card>
        <h2 className="text-xl font-semibold">Add an asset</h2>
        <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input className="min-h-12 min-w-0 rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" placeholder="Air conditioner" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="min-h-12 min-w-0 rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <Button>Add asset</Button>
        </form>
        {error && <div className="mt-4"><ErrorState message={error} /></div>}
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Saved assets</h2>
        {assets.error && <div className="mt-4"><ErrorState message="Login first to view your passport." /></div>}
        {assets.data?.length === 0 && <div className="mt-4"><EmptyState title="No assets yet" description="Add assets that may help NOVA prepare better tasks later." /></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {assets.data?.map((asset) => <div key={asset.id} className="rounded-2xl bg-mist p-4"><p className="font-medium">{asset.name}</p>{asset.brand && <p className="mt-1 text-sm text-gray-600">Brand: {asset.brand}</p>}{asset.notes && <p className="mt-1 text-sm text-gray-600">{asset.notes}</p>}</div>)}
        </div>
      </Card>
    </section>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type Asset = { id: string; name: string; type: string; brand?: string | null; model?: string | null; notes?: string | null };

export default function PassportPage() {
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/api/v1/assets") });
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/v1/assets", { method: "POST", body: JSON.stringify({ name, type: "appliance", brand: brand || null }) });
    setName("");
    setBrand("");
    assets.refetch();
  }
  return <section className="rounded-[2rem] bg-white p-6 shadow-soft"><h1 className="text-3xl font-semibold">Passport</h1><p className="mt-2 text-gray-600">Add simple assets so NOVA can use context later.</p><form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row"><input className="min-h-12 flex-1 rounded-2xl border px-4" placeholder="Air conditioner" value={name} onChange={(e) => setName(e.target.value)} required /><input className="min-h-12 flex-1 rounded-2xl border px-4" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} /><button className="rounded-full bg-ink px-5 text-white">Add asset</button></form>{assets.data?.length === 0 && <p className="mt-6 rounded-3xl bg-mist p-6">No assets yet.</p>}{assets.data?.map((asset) => <div key={asset.id} className="mt-4 rounded-2xl bg-mist p-4"><p className="font-medium">{asset.name}</p><p className="text-sm text-gray-600">{asset.brand}</p></div>)}</section>;
}

"use client";

import { FormEvent, useState } from "react";
import { apiFetch, saveTokens, TokenPair } from "@/lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const tokens = await apiFetch<TokenPair>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName || null }),
      });
      saveTokens(tokens);
      setMessage("Account created. NOVA is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md rounded-[2rem] bg-white p-8 shadow-soft">
      <h1 className="text-3xl font-semibold">Create account</h1>
      <label className="mt-6 block text-sm font-medium" htmlFor="register-name">Name</label>
      <input id="register-name" className="mt-2 min-h-12 w-full rounded-2xl border px-4" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <label className="mt-4 block text-sm font-medium" htmlFor="register-email">Email</label>
      <input id="register-email" className="mt-2 min-h-12 w-full rounded-2xl border px-4" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      <label className="mt-4 block text-sm font-medium" htmlFor="register-password">Password</label>
      <input id="register-password" className="mt-2 min-h-12 w-full rounded-2xl border px-4" value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required />
      <button className="mt-6 min-h-12 w-full rounded-full bg-ink text-white">Create account</button>
      {message && <p className="mt-4 rounded-2xl bg-mist p-3 text-sm" role="status" aria-live="polite">{message}</p>}
    </form>
  );
}

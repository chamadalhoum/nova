"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, saveTokens, TokenPair } from "@/lib/api";
import { Button, Card, LinkButton } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    try {
      const tokens = await apiFetch<TokenPair>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName || null }),
      });
      saveTokens(tokens);
      setMessage("Account created. NOVA is ready.");
      router.push("/app");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    }
  }

  return (
    <Card className="mx-auto max-w-md p-8">
    <form onSubmit={onSubmit}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-calm">Start executing</p>
      <h1 className="mt-2 text-3xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-gray-600">Create a private workspace for tasks, memories, assets, and notifications.</p>
      <label className="mt-6 block text-sm font-medium" htmlFor="register-name">Name</label>
      <input id="register-name" className="mt-2 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <label className="mt-4 block text-sm font-medium" htmlFor="register-email">Email</label>
      <input id="register-email" className="mt-2 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      <label className="mt-4 block text-sm font-medium" htmlFor="register-password">Password</label>
      <input id="register-password" className="mt-2 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required />
      <label className="mt-4 block text-sm font-medium" htmlFor="register-password-confirmation">Confirm password</label>
      <input id="register-password-confirmation" className="mt-2 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} type="password" minLength={8} required />
      <Button className="mt-6 min-h-12 w-full">Create account</Button>
      <LinkButton href="/login" variant="ghost" className="mt-2 w-full">I already have an account</LinkButton>
      {message && <p className="mt-4 rounded-2xl bg-mist p-3 text-sm" role="status" aria-live="polite">{message}</p>}
    </form>
    </Card>
  );
}

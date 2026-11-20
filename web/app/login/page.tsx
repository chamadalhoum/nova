"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, saveTokens, TokenPair } from "@/lib/api";
import { Button, Card, LinkButton } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const tokens = await apiFetch<TokenPair>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveTokens(tokens);
      setMessage("Logged in. You can start a task now.");
      try {
        const me = await apiFetch<{ role: string }>("/api/v1/me");
        router.push(me.role === "admin" ? "/admin" : "/app");
      } catch {
        // The session is valid even if the post-login role lookup is temporarily unavailable.
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  return <AuthForm title="Login" email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={onSubmit} message={message} />;
}

function AuthForm(props: { title: string; email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; onSubmit: (event: FormEvent) => void; message: string | null }) {
  return (
    <Card className="mx-auto max-w-md p-8">
    <form onSubmit={props.onSubmit}>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-calm">Welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold">{props.title}</h1>
      <p className="mt-2 text-sm text-gray-600">Sign in to continue your tasks and service requests.</p>
      <label className="mt-6 block text-sm font-medium" htmlFor="login-email">Email</label>
      <input id="login-email" className="mt-2 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={props.email} onChange={(e) => props.setEmail(e.target.value)} type="email" required />
      <label className="mt-4 block text-sm font-medium" htmlFor="login-password">Password</label>
      <input id="login-password" className="mt-2 min-h-12 w-full rounded-2xl border px-4 outline-none focus:border-calm focus:ring-4 focus:ring-calm/10" value={props.password} onChange={(e) => props.setPassword(e.target.value)} type="password" required />
      <Button className="mt-6 min-h-12 w-full">Continue</Button>
      <LinkButton href="/register" variant="ghost" className="mt-2 w-full">Create an account</LinkButton>
      {props.message && <p className="mt-4 rounded-2xl bg-mist p-3 text-sm" role="status" aria-live="polite">{props.message}</p>}
    </form>
    </Card>
  );
}

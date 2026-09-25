"use client";

import { FormEvent, useState } from "react";
import { apiFetch, saveTokens, TokenPair } from "@/lib/api";

export default function LoginPage() {
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  return <AuthForm title="Login" email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={onSubmit} message={message} />;
}

function AuthForm(props: { title: string; email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; onSubmit: (event: FormEvent) => void; message: string | null }) {
  return (
    <form onSubmit={props.onSubmit} className="mx-auto max-w-md rounded-[2rem] bg-white p-8 shadow-soft">
      <h1 className="text-3xl font-semibold">{props.title}</h1>
      <label className="mt-6 block text-sm font-medium" htmlFor="login-email">Email</label>
      <input id="login-email" className="mt-2 min-h-12 w-full rounded-2xl border px-4" value={props.email} onChange={(e) => props.setEmail(e.target.value)} type="email" required />
      <label className="mt-4 block text-sm font-medium" htmlFor="login-password">Password</label>
      <input id="login-password" className="mt-2 min-h-12 w-full rounded-2xl border px-4" value={props.password} onChange={(e) => props.setPassword(e.target.value)} type="password" required />
      <button className="mt-6 min-h-12 w-full rounded-full bg-ink text-white">Continue</button>
      {props.message && <p className="mt-4 rounded-2xl bg-mist p-3 text-sm" role="status" aria-live="polite">{props.message}</p>}
    </form>
  );
}

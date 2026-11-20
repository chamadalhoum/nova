"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import type { ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const statusTone: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  NEEDS_INFO: "bg-amber-100 text-amber-900",
  PLANNED: "bg-blue-100 text-blue-900",
  SEARCHING: "bg-blue-100 text-blue-900",
  WAITING_CONFIRMATION: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-emerald-100 text-emerald-900",
  IN_PROGRESS: "bg-indigo-100 text-indigo-900",
  COMPLETED: "bg-zinc-900 text-white",
  CANCELLED: "bg-rose-100 text-rose-900",
  FAILED: "bg-rose-100 text-rose-900",
  PREPARED: "bg-amber-100 text-amber-900",
};

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "To do",
    NEEDS_INFO: "Needs info",
    PLANNED: "Planned",
    SEARCHING: "Searching",
    WAITING_CONFIRMATION: "Needs confirmation",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
    PREPARED: "Prepared",
  };
  return labels[status] || status.replaceAll("_", " ").toLowerCase();
}

export function Button({ children, className, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        variant === "primary" && "bg-ink text-white shadow-sm hover:bg-black",
        variant === "secondary" && "border border-gray-200 bg-white text-ink hover:border-calm hover:bg-mist",
        variant === "ghost" && "bg-transparent text-ink hover:bg-mist",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children, className, variant = "primary" }: { href: string; children: ReactNode; className?: string; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none",
        variant === "primary" && "bg-ink text-white shadow-sm hover:bg-black",
        variant === "secondary" && "border border-gray-200 bg-white text-ink hover:border-calm hover:bg-mist",
        variant === "ghost" && "bg-transparent text-ink hover:bg-mist",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-soft", className)}>{children}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </Card>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex rounded-full bg-mist px-3 py-1 text-xs font-semibold text-gray-700", className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusTone[status] || "bg-mist text-gray-700"}>{statusLabel(status)}</Badge>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-[2rem] bg-white p-6 shadow-soft md:flex-row md:items-end">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.24em] text-calm">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-mist/60 p-6 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded-[1.5rem] bg-white p-5 text-sm text-gray-600 shadow-soft">{label}</div>;
}

export function ErrorState({ title = "Something went wrong.", message, requestId }: { title?: string; message?: string; requestId?: string | null }) {
  return (
    <div className="rounded-[1.5rem] bg-red-50 p-5 text-red-900">
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-2 text-sm">{message}</p>}
      {requestId && <code className="mt-3 block rounded-xl bg-white/70 p-2 text-xs">Request ID: {requestId}</code>}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-8 px-3 text-xs"
      onClick={async () => {
        await navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-[1.5rem] bg-mist p-3 sm:flex-row sm:items-center">{children}</div>;
}

export function DataTable<T>({ columns, rows, getKey }: { columns: Array<{ key: string; header: string; render: (row: T) => ReactNode; className?: string }>; rows: T[]; getKey: (row: T) => string }) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-gray-100 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-mist text-xs uppercase tracking-wide text-gray-500">
          <tr>{columns.map((column) => <th key={column.key} className={cn("px-4 py-3 font-semibold", column.className)}>{column.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => <tr key={getKey(row)} className="align-top hover:bg-mist/40">{columns.map((column) => <td key={column.key} className={cn("px-4 py-3", column.className)}>{column.render(row)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

const adminNav = [
  ["Dashboard", "/admin/dashboard"],
  ["Users", "/admin/users"],
  ["Tasks", "/admin/tasks"],
  ["Service Requests", "/admin/service-requests"],
  ["Providers", "/admin/providers"],
  ["AI Observability", "/admin/ai"],
  ["Audit Logs", "/admin/audit-logs"],
];

export function AdminShell({ children, onLogout, adminEmail }: { children: ReactNode; onLogout?: () => void; adminEmail?: string | null }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <AdminSidebar />
      <div className="min-w-0">
        <AdminHeader adminEmail={adminEmail} onLogout={onLogout} />
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="rounded-[2rem] bg-ink p-4 text-white shadow-soft lg:sticky lg:top-24 lg:h-fit">
      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">NOVA</p>
        <h1 className="mt-1 text-xl font-semibold">Administration</h1>
      </div>
      <nav className="mt-5 flex gap-1 overflow-x-auto pb-1 text-sm lg:grid lg:overflow-visible" aria-label="Admin navigation">
        {adminNav.map(([label, href]) => {
          const active = pathname === href || (href !== "/admin/dashboard" && pathname?.startsWith(href));
          return <Link key={href} href={href} className={cn("whitespace-nowrap rounded-2xl px-3 py-2 text-white/75 transition hover:bg-white/10 hover:text-white", active && "bg-white text-ink hover:bg-white hover:text-ink")}>{label}</Link>;
        })}
      </nav>
    </aside>
  );
}

export function AdminHeader({ adminEmail, onLogout }: { adminEmail?: string | null; onLogout?: () => void }) {
  return (
    <header className="flex flex-col justify-between gap-3 rounded-[1.75rem] bg-white px-5 py-4 shadow-soft sm:flex-row sm:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-calm">Administration</p>
        <h2 className="text-2xl font-semibold text-ink">NOVA Back-office</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        {adminEmail && <span className="rounded-full bg-mist px-3 py-2">{adminEmail}</span>}
        {onLogout && <Button variant="secondary" className="min-h-10" onClick={onLogout}>Logout</Button>}
      </div>
    </header>
  );
}

export function Pagination({ limit, offset, total, onPrevious, onNext }: { limit: number; offset: number; total: number; onPrevious: () => void; onNext: () => void }) {
  const shown = Math.min(limit, Math.max(0, total - offset));
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.ceil(total / limit);
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
      <span>{total === 0 ? "No records" : `Showing ${offset + 1}-${offset + shown} of ${total} · Page ${page} of ${pageCount}`}</span>
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-9 px-4" disabled={offset === 0} onClick={onPrevious}>Previous</Button>
        <Button variant="secondary" className="min-h-9 px-4" disabled={offset + limit >= total} onClick={onNext}>Next</Button>
      </div>
    </div>
  );
}

export function Timeline({ events }: { events: Array<{ id: string; event_type: string; message: string; created_at?: string }> }) {
  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={event.id} className="grid grid-cols-[1.5rem_1fr] gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-3 w-3 rounded-full bg-ink" />
            {index < events.length - 1 && <span className="mt-1 h-full min-h-10 w-px bg-gray-200" />}
          </div>
          <div className="rounded-2xl bg-mist p-4">
            <p className="font-medium capitalize">{event.event_type.replaceAll("_", " ")}</p>
            <p className="mt-1 text-sm text-gray-600">{event.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

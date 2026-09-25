import Link from "next/link";

const adminNav = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Tasks", "/admin/tasks"],
  ["Service requests", "/admin/service-requests"],
  ["Providers", "/admin/providers"],
  ["AI", "/admin/ai"],
  ["Audit logs", "/admin/audit-logs"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-[2rem] bg-ink p-4 text-white shadow-soft">
        <h1 className="px-2 text-lg font-semibold">Admin</h1>
        <nav className="mt-4 grid gap-1 text-sm" aria-label="Admin navigation">
          {adminNav.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-2xl px-3 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </section>
  );
}

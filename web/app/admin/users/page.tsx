"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, AdminUser, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";

export default function AdminUsersPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-users", offset], queryFn: () => apiFetch<AdminPage<AdminUser>>(`/api/v1/admin/users?limit=${limit}&offset=${offset}`), enabled: hasToken });
  if (!hasToken) return <p className="rounded-3xl bg-red-50 p-5 text-red-800">Login with an admin account.</p>;
  if (isLoading) return <p className="rounded-3xl bg-white p-5 shadow-soft">Loading users...</p>;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">Users</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-gray-500"><th>Email</th><th>Role</th><th>Active</th><th>Created</th></tr></thead>
          <tbody>{data?.items.map((user) => <tr key={user.id} className="border-t"><td className="py-3">{user.email}</td><td>{user.role}</td><td>{String(user.is_active)}</td><td>{user.created_at}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Showing {offset + 1}-{offset + (data?.items.length ?? 0)} of {data?.total ?? 0}</span>
        <div className="flex gap-2"><button className="rounded-full border px-3 py-1 disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button><button className="rounded-full border px-3 py-1 disabled:opacity-40" disabled={!data || offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>Next</button></div>
      </div>
    </section>
  );
}

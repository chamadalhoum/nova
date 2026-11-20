"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminPage, AdminUser, apiFetch, getAccessToken } from "@/lib/api";
import { AdminError } from "../admin-error";
import { Badge, CopyButton, DataTable, EmptyState, FilterBar, LinkButton, LoadingState, Pagination } from "@/components/ui";

export default function AdminUsersPage() {
  const hasToken = Boolean(getAccessToken());
  const [offset, setOffset] = useState(0);
  const [role, setRole] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const limit = 50;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      setSearch(nextSearch);
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (role) params.set("role", role);
  if (search) params.set("q", search);
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-users", offset, role, search], queryFn: () => apiFetch<AdminPage<AdminUser>>(`/api/v1/admin/users?${params}`), enabled: hasToken });
  const users = data?.items ?? [];
  if (!hasToken) return <EmptyState title="Admin login required" description="Login with an admin account." />;
  if (isLoading) return <LoadingState label="Loading users..." />;
  if (error) return <AdminError error={error} />;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-semibold">Users</h2>
      <div className="mt-5"><FilterBar><input className="min-h-11 rounded-2xl border px-3" placeholder="Search users" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><select className="min-h-11 rounded-2xl border px-3" value={role} onChange={(event) => { setRole(event.target.value); setOffset(0); }}><option value="">All roles</option><option value="admin">Admin</option><option value="user">User</option></select></FilterBar></div>
      <div className="mt-5"><DataTable<AdminUser> rows={users} getKey={(user) => user.id} columns={[{ key: "user", header: "User", render: (user) => <div><p className="font-medium text-ink">{user.full_name || "Unnamed user"}</p><p className="text-xs text-gray-500">{user.email}</p></div> }, { key: "role", header: "Role", render: (user) => <Badge className={user.role === "admin" ? "bg-ink text-white" : undefined}>{user.role}</Badge> }, { key: "status", header: "Status", render: (user) => user.is_active ? "Active" : "Inactive" }, { key: "created", header: "Created", render: (user) => <span className="text-xs text-gray-500">{user.created_at}</span> }, { key: "actions", header: "Actions", render: (user) => <div className="flex gap-1"><LinkButton href={`/admin/users/${user.id}`} variant="ghost" className="min-h-8 px-3 text-xs">View</LinkButton><CopyButton value={user.id} label="Copy ID" /></div> }]} /></div>
      {users.length === 0 && <div className="mt-4"><EmptyState title="No users found" /></div>}
      {data && <Pagination limit={limit} offset={offset} total={data.total} onPrevious={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />}
    </section>
  );
}

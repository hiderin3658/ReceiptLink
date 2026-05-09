"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Shield } from "lucide-react";
import {
  createAllowedUser,
  deleteAllowedUser,
  updateAllowedUserRole,
} from "@/lib/auth/allowed-users-actions";
import type { AllowedUser } from "@/types/database";

interface Props {
  users: AllowedUser[];
  currentUserEmail: string;
}

export function AllowedUsersSection({ users, currentUserEmail }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newNote, setNewNote] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAllowedUser(null, {
        email: newEmail,
        role: newRole,
        note: newNote,
      });
      if (result?.ok === false) setError(result.message);
      else {
        setNewEmail("");
        setNewRole("user");
        setNewNote("");
      }
    });
  }

  function handleRoleChange(id: string, role: "admin" | "user") {
    setError(null);
    startTransition(async () => {
      const result = await updateAllowedUserRole(id, role);
      if (result?.ok === false) setError(result.message);
    });
  }

  function handleDelete(u: AllowedUser) {
    if (u.email === currentUserEmail) {
      alert("自分自身を削除することはできません。");
      return;
    }
    if (!confirm(`${u.email} をホワイトリストから削除しますか？`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAllowedUser(u.id);
      if (result?.ok === false) setError(result.message);
    });
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Shield size={14} className="text-[var(--color-primary)]" aria-hidden />
        <h2 className="text-sm font-semibold">ホワイトリスト管理 (admin only)</h2>
      </div>

      <ul className="mb-3 space-y-1.5">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">{u.email}</span>
              {u.note && (
                <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                  {u.note}
                </span>
              )}
            </div>
            <select
              value={u.role}
              onChange={(e) => handleRoleChange(u.id, e.target.value as "admin" | "user")}
              disabled={pending || u.email === currentUserEmail}
              className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1 text-xs"
              aria-label={`${u.email} のロール`}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="button"
              onClick={() => handleDelete(u)}
              disabled={pending || u.email === currentUserEmail}
              className="rounded p-1.5 text-[var(--color-destructive)] hover:bg-[var(--color-muted)] disabled:opacity-30"
              aria-label="削除"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="space-y-2 rounded-md border border-dashed border-[var(--color-border)] p-3">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
            className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          maxLength={200}
          placeholder="メモ（任意）"
          className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
          >
            <Plus size={12} aria-hidden /> 追加
          </button>
          {error && (
            <span role="alert" className="text-xs text-[var(--color-destructive)]">
              {error}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

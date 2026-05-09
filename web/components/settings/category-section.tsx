"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/expense/category-actions";
import type { ExpenseCategory } from "@/types/database";

interface Props {
  categories: ExpenseCategory[];
  currentUserId: string;
}

export function CategorySection({ categories, currentUserId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const standard = categories.filter((c) => c.user_id === null);
  const custom = categories.filter((c) => c.user_id === currentUserId);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createCategory(null, { name: newName });
      if (result?.ok === false) setError(result.message);
      else setNewName("");
    });
  }

  function startEdit(c: ExpenseCategory) {
    setEditingId(c.id);
    setEditingName(c.name);
  }

  function saveEdit() {
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCategory(editingId, null, { name: editingName });
      if (result?.ok === false) setError(result.message);
      else {
        setEditingId(null);
        setEditingName("");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`カテゴリ「${name}」を削除しますか？\n（このカテゴリを使用している支出があると削除できません）`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result?.ok === false) setError(result.message);
    });
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">カテゴリ管理</h2>

      <h3 className="mb-1 text-xs text-[var(--color-muted-foreground)]">標準カテゴリ（編集不可）</h3>
      <ul className="mb-4 flex flex-wrap gap-1.5">
        {standard.map((c) => (
          <li
            key={c.id}
            className="rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs"
          >
            {c.name}
          </li>
        ))}
      </ul>

      <h3 className="mb-1 text-xs text-[var(--color-muted-foreground)]">独自カテゴリ</h3>
      {custom.length === 0 ? (
        <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
          まだ独自カテゴリはありません。
        </p>
      ) : (
        <ul className="mb-3 space-y-1">
          {custom.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              {editingId === c.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    maxLength={20}
                    className="flex-1 rounded border border-[var(--color-border)] px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={pending}
                    className="rounded p-1 text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
                    aria-label="保存"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 hover:bg-[var(--color-muted)]"
                    aria-label="キャンセル"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="rounded p-1 hover:bg-[var(--color-muted)]"
                    aria-label="編集"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={pending}
                    className="rounded p-1 text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
                    aria-label="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しいカテゴリ名"
          maxLength={20}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || newName.trim().length === 0}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          <Plus size={14} aria-hidden /> 追加
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--color-destructive)]">
          {error}
        </p>
      )}
    </section>
  );
}

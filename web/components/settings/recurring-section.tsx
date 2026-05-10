"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Repeat, Check, X } from "lucide-react";
import {
  createRecurring,
  deleteRecurring,
  updateRecurring,
  type RecurringInput,
} from "@/lib/expense/recurring-crud-actions";
import type { ExpenseCategory, RecurringExpense } from "@/types/database";

interface Props {
  recurring: RecurringExpense[];
  categories: ExpenseCategory[];
}

type DraftState = RecurringInput;

const emptyDraft: DraftState = {
  name: "",
  category_id: "",
  amount: 0,
  day_of_month: 1,
  active: true,
  note: "",
};

export function RecurringSection({ recurring, categories }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftState>({
    ...emptyDraft,
    category_id: categories[0]?.id ?? "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  function reset() {
    setShowForm(false);
    setEditingId(null);
    setDraft({ ...emptyDraft, category_id: categories[0]?.id ?? "" });
    setError(null);
  }

  function startEdit(r: RecurringExpense) {
    setEditingId(r.id);
    setShowForm(true);
    setDraft({
      name: r.name,
      category_id: r.category_id,
      amount: r.amount,
      day_of_month: r.day_of_month,
      active: r.active,
      note: r.note ?? "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const action = editingId
        ? updateRecurring(editingId, null, draft)
        : createRecurring(null, draft);
      const result = await action;
      if (result?.ok === false) {
        setError(result.message);
      } else {
        reset();
      }
    });
  }

  function handleDelete(r: RecurringExpense) {
    if (!confirm(`固定費「${r.name}」を削除しますか？\n（過去の計上履歴は残ります）`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteRecurring(r.id);
      if (result?.ok === false) setError(result.message);
    });
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">固定費管理</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
          >
            <Plus size={14} aria-hidden /> 追加
          </button>
        )}
      </div>

      {recurring.length === 0 && !showForm ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          固定費（家賃 / サブスク / 光熱費の定額部分など）を登録すると、ホーム画面から月次計上できます。
        </p>
      ) : (
        <ul className="mb-3 space-y-2">
          {recurring.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Repeat size={12} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
                    <span className="break-words">{r.name}</span>
                    {!r.active && (
                      <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs">停止中</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                    {categoryNameById.get(r.category_id) ?? "(カテゴリ未設定)"} ・
                    毎月 {r.day_of_month} 日 ・ ¥{r.amount.toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="rounded p-1.5 hover:bg-[var(--color-muted)]"
                    aria-label="編集"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    disabled={pending}
                    className="rounded p-1.5 text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
                    aria-label="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-dashed border-[var(--color-border)] p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="名前">
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={50}
                placeholder="例: 家賃"
                className={inputCls}
              />
            </Field>
            <Field label="カテゴリ">
              <select
                value={draft.category_id}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="金額（円）">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={draft.amount as number}
                onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })}
                className={inputCls}
              />
            </Field>
            <Field label="計上日（毎月）">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                required
                value={draft.day_of_month as number}
                onChange={(e) => setDraft({ ...draft, day_of_month: Number(e.target.value) || 1 })}
                className={inputCls}
              />
              <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                月末日が無い場合（2/31 等）はその月の月末に丸めます
              </span>
            </Field>
          </div>
          <Field label="メモ（任意）">
            <input
              type="text"
              value={draft.note ?? ""}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              maxLength={200}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            計上を有効化
          </label>

          {error && (
            <p role="alert" className="text-xs text-[var(--color-destructive)]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
            >
              <X size={12} aria-hidden /> キャンセル
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
            >
              <Check size={12} aria-hidden /> {editingId ? "更新" : "追加"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--color-muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

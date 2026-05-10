"use client";

// 支出登録フォーム（新規・編集兼用）
//
// クライアント側でアイテム配列を State 管理し、submit 時に Server Action を呼ぶ。
// Zod は actions.ts 側で再検証するため、ここでは UX のための簡易チェックのみ。

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createExpenseRecord,
  updateExpenseRecord,
  type ExpenseActionState,
} from "@/lib/expense/actions";
import { pickFallbackCategoryId } from "@/lib/expense/categories";
import {
  calcTotalAmount,
  makeEmptyItem,
  type ExpenseItemInput,
  type ExpenseRecordInput,
} from "@/lib/expense/schema";
import type { ExpenseCategory } from "@/types/database";

type Props =
  | {
      mode: "create";
      categories: ExpenseCategory[];
      /** OCR からのプリフィル等、create 時にも初期値を渡せる */
      initial?: ExpenseRecordInput;
    }
  | {
      mode: "edit";
      categories: ExpenseCategory[];
      recordId: string;
      initial: ExpenseRecordInput;
    };

export function ExpenseForm(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fallbackCategoryId = useMemo(
    () => pickFallbackCategoryId(props.categories),
    [props.categories],
  );

  const today = new Date().toISOString().slice(0, 10);
  const initial: ExpenseRecordInput = props.initial ?? {
    purchased_at: today,
    store_name: "",
    total_amount: 0,
    note: "",
    source_type: "manual",
    image_paths: [],
    items: [makeEmptyItem(fallbackCategoryId)],
  };

  const [purchasedAt, setPurchasedAt] = useState(initial.purchased_at);
  const [storeName, setStoreName] = useState(initial.store_name ?? "");
  // 合計金額の初期値:
  //  - OCR 由来 (initial.total_amount > 0) → そのまま採用 (税込支払額を保持)
  //  - 編集モード (既存 record の total_amount > 0) → そのまま採用
  //  - 新規・手入力 (0 のとき) → 空文字のままで品目合計を自動採用 (PR #13 の挙動)
  // 過去 PR #13 で常時 "" にしていたが、OCR の税込合計が握り潰されるバグが
  // 出たため initial.total_amount > 0 のときは採用する形に変更。
  const [totalAmount, setTotalAmount] = useState<string>(
    Number(initial.total_amount) > 0 ? String(initial.total_amount) : "",
  );
  const [note, setNote] = useState(initial.note ?? "");
  const [items, setItems] = useState<ExpenseItemInput[]>(
    initial.items.length > 0 ? initial.items : [makeEmptyItem(fallbackCategoryId)],
  );
  // 画像パス（OCR 経由のときのみ非空）。表示はバッジに集約して編集 UI は出さない
  const imagePaths = initial.image_paths ?? [];
  const sourceType = initial.source_type ?? "manual";

  const computedTotal = useMemo(
    () =>
      calcTotalAmount(
        items.map((it) => ({
          total_price: typeof it.total_price === "number" ? it.total_price : Number(it.total_price ?? 0),
          discount: typeof it.discount === "number" ? it.discount : Number(it.discount ?? 0),
        })),
      ),
    [items],
  );

  function updateItem(index: number, patch: Partial<ExpenseItemInput>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, makeEmptyItem(fallbackCategoryId)]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 値引 > 金額 の行があると DB CHECK で阻止され「保存に失敗しました」しか表示されない。
    // ユーザーが原因を特定できるよう、submit 前にローカルで検出して具体メッセージを出す。
    const overRow = items.findIndex(
      (it) => Number(it.discount ?? 0) > Number(it.total_price ?? 0),
    );
    if (overRow !== -1) {
      setError(
        `${overRow + 1} 行目: 値引額が金額を超えています。値引は金額以下にしてください`,
      );
      return;
    }

    // 入力欄が空なら明細合計を採用（ラベルの「未入力なら明細から自動」仕様）
    const trimmedTotal = totalAmount.trim();
    const resolvedTotal = trimmedTotal === "" ? computedTotal : Number(trimmedTotal) || 0;

    const payload: ExpenseRecordInput = {
      purchased_at: purchasedAt,
      store_name: storeName,
      total_amount: resolvedTotal,
      note,
      source_type: sourceType,
      image_paths: imagePaths,
      items,
    };

    startTransition(async () => {
      const action: (
        prev: ExpenseActionState,
        input: ExpenseRecordInput,
      ) => Promise<ExpenseActionState> =
        props.mode === "create"
          ? createExpenseRecord
          : (prev, input) => updateExpenseRecord(props.recordId, prev, input);

      const result = await action(null, payload);
      if (!result || !result.ok) {
        const message = result?.ok === false ? result.message : "保存に失敗しました";
        if (result && result.ok === false && result.fieldErrors) {
          const allErrors = Object.values(result.fieldErrors).flat().filter(Boolean);
          const shown = allErrors.slice(0, 3).join(" / ");
          const omitted = allErrors.length > 3 ? ` 他 ${allErrors.length - 3} 件` : "";
          setError(`${message}: ${shown}${omitted}`);
        } else {
          setError(message);
        }
        return;
      }
      router.push(`/expense/${result.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ヘッダー */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 space-y-3">
        {sourceType === "receipt" && imagePaths.length > 0 && (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            📷 レシート画像 {imagePaths.length} 枚から自動入力されました
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="購入日">
            <input
              type="date"
              required
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="店舗名（任意）">
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="例: ライフ"
              maxLength={100}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Field
              label={`合計金額（未入力なら明細から自動: ¥${computedTotal.toLocaleString()}）`}
            >
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder={
                  props.mode === "edit" && Number(initial.total_amount) > 0
                    ? `元値: ${Number(initial.total_amount).toLocaleString()}`
                    : "0"
                }
                className={inputCls}
              />
            </Field>
            {/* 明細合計と入力された合計の差を補助表示 (両方の値が確認しやすくなる)。
                差は消費税・値引きの大きさを示す目安となる。 */}
            {(() => {
              const entered = Number(totalAmount.trim()) || 0;
              if (entered <= 0 || entered === computedTotal) return null;
              const diff = entered - computedTotal;
              return (
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  明細合計 ¥{computedTotal.toLocaleString()} / 差 {diff >= 0 ? "+" : ""}¥
                  {diff.toLocaleString()}（消費税・値引きを含む可能性）
                </p>
              );
            })()}
          </div>
          <Field label="メモ（任意）">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="例: 週末の買い出し"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* 品目リスト */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">品目リスト</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
          >
            <Plus size={14} aria-hidden /> 行を追加
          </button>
        </div>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-[var(--color-border)] bg-white p-3 space-y-2"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Field label="品名">
                  <input
                    type="text"
                    required
                    value={item.raw_name}
                    onChange={(e) => updateItem(i, { raw_name: e.target.value })}
                    placeholder="例: 豚ロース / シャンプー"
                    maxLength={100}
                    className={inputCls}
                  />
                </Field>
                <Field label="カテゴリ">
                  <select
                    value={item.category_id}
                    onChange={(e) =>
                      updateItem(i, { category_id: e.target.value })
                    }
                    className={cn(inputCls, "min-w-[8rem]")}
                  >
                    {props.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Field label="数量">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min={0}
                    value={item.quantity ?? ""}
                    onChange={(e) =>
                      updateItem(i, {
                        quantity: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="1"
                    className={inputCls}
                  />
                </Field>
                <Field label="単位">
                  <input
                    type="text"
                    value={item.unit ?? ""}
                    onChange={(e) => updateItem(i, { unit: e.target.value })}
                    placeholder="個 / g / パック"
                    maxLength={20}
                    className={inputCls}
                  />
                </Field>
                <Field label="金額（円）">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={String(item.total_price ?? 0)}
                    onChange={(e) =>
                      updateItem(i, { total_price: Number(e.target.value) || 0 })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="値引（円）">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={String(item.discount ?? 0)}
                    onChange={(e) =>
                      updateItem(i, { discount: Number(e.target.value) || 0 })
                    }
                    className={inputCls}
                  />
                </Field>
              </div>
              {items.length > 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
                    aria-label={`${i + 1} 行目を削除`}
                  >
                    <Trash2 size={14} aria-hidden /> 削除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* エラー表示 */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--color-destructive)] bg-[color-mix(in_oklch,var(--color-destructive)_10%,white)] p-3 text-sm text-[var(--color-destructive)]"
        >
          {error}
        </div>
      )}

      {/* 操作ボタン */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-[var(--color-border)] bg-white px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? "保存中..." : props.mode === "edit" ? "更新する" : "登録する"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--color-muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

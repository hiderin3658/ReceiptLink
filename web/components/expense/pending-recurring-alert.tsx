"use client";

// 未計上の固定費アラート + 一括登録ボタン（ダッシュボード上部に表示）
//
// 設計書: docs/design.md §7

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Repeat, Loader2 } from "lucide-react";
import { generatePendingExpensesAction } from "@/lib/expense/recurring-actions";

interface Props {
  pendingCount: number;
  /** 未計上があるテンプレ名のサンプル（最大 3 件、UI 表示用） */
  templateNames: string[];
}

export function PendingRecurringAlert({ pendingCount, templateNames }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (pendingCount === 0) return null;

  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePendingExpensesAction(null);
      if (result.ok) {
        alert(result.message);
        router.refresh();
      } else {
        alert(`${result.message}: ${result.errors.slice(0, 3).join(" / ")}`);
      }
    });
  }

  return (
    <section
      className="rounded-lg border border-[color-mix(in_oklch,var(--color-primary)_30%,transparent)] bg-[color-mix(in_oklch,var(--color-primary)_5%,white)] p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Repeat size={20} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold">
              未計上の固定費が <span className="text-[var(--color-primary)]">{pendingCount}</span> 件あります
            </p>
            {templateNames.length > 0 && (
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {templateNames.slice(0, 3).join(" / ")}
                {templateNames.length > 3 && ` 他 ${templateNames.length - 3} 件`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
          >
            {pending && <Loader2 size={12} className="animate-spin" aria-hidden />}
            {pending ? "計上中..." : `${pendingCount} 件を計上`}
          </button>
        </div>
      </div>
    </section>
  );
}

/** 固定費機能をまだ使っていない（テンプレ 0 件）ユーザー向けの情報バナー（任意） */
export function NoRecurringHint() {
  return (
    <section className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted-foreground)]">
      <AlertCircle size={12} className="mr-1 inline" aria-hidden />
      家賃・サブスク・光熱費の定額部分などは{" "}
      <Link
        href="/settings"
        className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
      >
        設定 → 固定費管理
      </Link>{" "}
      で登録すると、毎月ボタン 1 つで計上できます。
    </section>
  );
}

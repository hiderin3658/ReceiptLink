// ダッシュボード（ホーム）
//
// 設計書: docs/design.md §5 / §8

import Link from "next/link";
import { Plus, Receipt, Settings as SettingsIcon } from "lucide-react";
import { CategoryPie, type CategoryPieDatum } from "@/components/charts/CategoryPie";
import { PendingRecurringAlert, NoRecurringHint } from "@/components/expense/pending-recurring-alert";
import { loadDashboardData } from "@/lib/expense/dashboard-queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await loadDashboardData();
  const categoryNameById = new Map(data.categories.map((c) => [c.id, c.name]));

  // 円グラフ用データ
  const pieData: CategoryPieDatum[] = data.breakdown.map((b) => ({
    category_id: b.category_id,
    name: categoryNameById.get(b.category_id) ?? "(削除済み)",
    value: b.total,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">ホーム</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {labelOf(data.yearMonth)}の支出サマリー
        </p>
      </header>

      {/* 未計上固定費アラート */}
      {data.pendingRecurring.count > 0 ? (
        <PendingRecurringAlert
          pendingCount={data.pendingRecurring.count}
          templateNames={data.pendingRecurring.templateNames}
        />
      ) : (
        <NoRecurringHint />
      )}

      {/* 今月の合計 (固定費の有無で精度がブレる「月末ペース予想」はユーザー要望により非表示) */}
      <section>
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs text-[var(--color-muted-foreground)]">今月の合計</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            ¥{data.pace.actualToDate.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {data.pace.elapsedDays} 日 / {data.pace.daysInMonth} 日 経過
          </p>
        </div>
      </section>

      {/* カテゴリ別 円グラフ */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">カテゴリ別 内訳</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
          {pieData.length > 0 ? (
            <>
              <CategoryPie data={pieData} />
              {/* 凡例補足: 円グラフ下に明細の数値 */}
              <ul className="mt-2 space-y-1">
                {pieData.map((d) => (
                  <li
                    key={d.category_id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>{d.name}</span>
                    <span className="tabular-nums font-medium">
                      ¥{d.value.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-center text-sm text-[var(--color-muted-foreground)]">
              今月の支出がまだありません
            </p>
          )}
        </div>
      </section>

      {/* クイックアクション */}
      <section className="grid gap-2 sm:grid-cols-3">
        <Link
          href="/expense/new"
          className="flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          <Plus size={16} aria-hidden /> 支出を登録
        </Link>
        <Link
          href="/expense"
          className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm hover:bg-[var(--color-muted)]"
        >
          <Receipt size={16} aria-hidden /> 履歴を見る
        </Link>
        <Link
          href="/settings"
          className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm hover:bg-[var(--color-muted)]"
        >
          <SettingsIcon size={16} aria-hidden /> 設定
        </Link>
      </section>
    </div>
  );
}

function labelOf(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return `${y}年${Number(m)}月`;
}

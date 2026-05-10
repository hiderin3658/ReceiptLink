// レポート画面: 月次推移 + カテゴリ別 + 前月比 + CSV ダウンロード
//
// 設計書: docs/design.md §5 / §8

import Link from "next/link";
import type { Route } from "next";
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { CategoryPie, type CategoryPieDatum } from "@/components/charts/CategoryPie";
import { MonthlyBar } from "@/components/charts/MonthlyBar";
import { loadReportData } from "@/lib/expense/report-queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ ym?: string; months?: string }>;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { ym, months } = await searchParams;
  const historyMonths = months === "12" ? 12 : 6;
  const data = await loadReportData(ym, historyMonths);

  const categoryNameById = new Map(data.categories.map((c) => [c.id, c.name]));
  const pieData: CategoryPieDatum[] = data.breakdown.map((b) => ({
    category_id: b.category_id,
    name: categoryNameById.get(b.category_id) ?? "(削除済み)",
    value: b.total,
  }));

  const [yStr, mStr] = data.yearMonth.split("-");
  const targetDate = new Date(Number(yStr), Number(mStr) - 1, 1);
  // 前月・次月（年またぎを Date が自動補正してくれる）
  const prevDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const nextDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
  const nextYm = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
  // 未来月への遷移は禁止（今月以降はリンクを薄表示）
  const today = new Date();
  const todayYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const isCurrent = data.yearMonth === todayYm;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">レポート</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          月次推移とカテゴリ別の内訳
        </p>
      </header>

      {/* 月切替 */}
      <section className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white p-3">
        <Link
          href={{ pathname: "/reports", query: { ym: prevYm, months: String(historyMonths) } }}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
        >
          <ChevronLeft size={16} aria-hidden /> 前月
        </Link>
        <span className="text-sm font-semibold">{labelOf(data.yearMonth)}</span>
        {isCurrent ? (
          <span className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[var(--color-muted-foreground)]">
            次月 <ChevronRight size={16} aria-hidden />
          </span>
        ) : (
          <Link
            href={{ pathname: "/reports", query: { ym: nextYm, months: String(historyMonths) } }}
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            次月 <ChevronRight size={16} aria-hidden />
          </Link>
        )}
      </section>

      {/* 当月合計 + 前月比 */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <p className="text-xs text-[var(--color-muted-foreground)]">{labelOf(data.yearMonth)}の合計</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">¥{data.monthTotal.toLocaleString()}</p>
        {data.momRatio !== null && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs">
            {data.momRatio >= 0 ? (
              <TrendingUp size={12} className="text-[var(--color-destructive)]" aria-hidden />
            ) : (
              <TrendingDown size={12} className="text-emerald-600" aria-hidden />
            )}
            <span className={data.momRatio >= 0 ? "text-[var(--color-destructive)]" : "text-emerald-600"}>
              前月比 {data.momRatio >= 0 ? "+" : ""}
              {data.momRatio}%
            </span>
          </p>
        )}
      </section>

      {/* 月次推移 棒グラフ */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">月次推移</h2>
          <div className="flex items-center gap-1 text-xs">
            <RangeLink ym={data.yearMonth} months={6} active={historyMonths === 6} />
            <RangeLink ym={data.yearMonth} months={12} active={historyMonths === 12} />
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
          <MonthlyBar data={data.history} />
        </div>
      </section>

      {/* カテゴリ別 円グラフ */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">カテゴリ別内訳（{labelOf(data.yearMonth)}）</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
          {pieData.length > 0 ? (
            <>
              <CategoryPie data={pieData} />
              <ul className="mt-2 space-y-1">
                {pieData.map((d) => (
                  <li key={d.category_id} className="flex items-center justify-between text-xs">
                    <span>{d.name}</span>
                    <span className="tabular-nums font-medium">¥{d.value.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-center text-sm text-[var(--color-muted-foreground)]">
              この月の支出がありません
            </p>
          )}
        </div>
      </section>

      {/* CSV ダウンロード */}
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">エクスポート</h2>
        <a
          href="/api/expense/export"
          download
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          <Download size={14} aria-hidden /> 全期間 CSV をダウンロード
        </a>
      </section>
    </div>
  );

}

function RangeLink({ ym, months, active }: { ym: string; months: number; active: boolean }) {
  // 同 pathname で months クエリだけ変更すると Next.js が遷移をスキップする問題を回避するため、
  // object href ではなく文字列 href を使う。typedRoutes でも path 部分が固定なら許容される。
  return (
    <Link
      href={`/reports?ym=${encodeURIComponent(ym)}&months=${months}` as Route}
      className={
        "rounded-md border border-[var(--color-border)] px-2 py-1 " +
        (active
          ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "bg-white hover:bg-[var(--color-muted)]")
      }
    >
      {months}ヶ月
    </Link>
  );
}

function labelOf(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  return `${y}年${Number(m)}月`;
}

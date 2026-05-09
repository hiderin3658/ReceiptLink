// ダッシュボード: 暫定スタブ（PR-5 で本格実装に置き換え）
// 設計: docs/design.md §5 / §8

import Link from "next/link";
import { Receipt, Plus } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">ホーム</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          月次の集計やカテゴリ別グラフは PR-5 で実装予定です。
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
        <p className="text-sm">
          支出を登録するか、過去の履歴を確認できます。
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/expense/new"
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)]"
          >
            <Plus size={16} aria-hidden /> 支出を登録
          </Link>
          <Link
            href="/expense"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
          >
            <Receipt size={16} aria-hidden /> 履歴を見る
          </Link>
        </div>
      </section>
    </div>
  );
}

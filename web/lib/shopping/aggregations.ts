// 純粋関数の集約ロジック。queries.ts と独立してテスト可能。
//
// queries.ts の DB アクセス部分とロジックを切り分けることで、
// 単体テスト（vitest）で集計の正しさを検証しやすくする。

export type RecordRow = {
  purchased_at: string; // YYYY-MM-DD
  total_amount: number;
};

export type MonthlyRow = {
  year_month: string; // YYYY-MM
  total: number;
  record_count: number;
};

/** 直近 N ヶ月分のレコードから YYYY-MM をキーに合計と件数を集計し、新しい月が先頭になるよう並べる */
export function aggregateMonthlySummary(rows: RecordRow[]): MonthlyRow[] {
  const map = new Map<string, { total: number; record_count: number }>();
  for (const r of rows) {
    const ym = r.purchased_at.slice(0, 7);
    const cur = map.get(ym) ?? { total: 0, record_count: 0 };
    cur.total += r.total_amount;
    cur.record_count += 1;
    map.set(ym, cur);
  }
  return [...map.entries()]
    .map(([year_month, v]) => ({ year_month, ...v }))
    .sort((a, b) => (a.year_month < b.year_month ? 1 : -1));
}

// dedupeIngredientNames はレシピ提案用だったため Phase 1 で削除。
// 集計系の純粋関数は PR-3 で expense 用 aggregations に拡張する。

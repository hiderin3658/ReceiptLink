// 純粋関数の集約ロジック。queries.ts と独立してテスト可能。
//
// 設計書: docs/design.md §8

export type RecordRow = {
  purchased_at: string; // ISO 8601 (YYYY-MM-DD or full timestamptz)
  total_amount: number;
};

export type MonthlyRow = {
  year_month: string; // YYYY-MM
  total: number;
  record_count: number;
};

export type ItemForAggregation = {
  category_id: string;
  total_price: number;
  discount: number;
  expense_record_id: string;
  /** 親 record の購入日（aggregations は items 単独だと月が分からないため） */
  purchased_at: string;
};

export type CategoryBreakdownRow = {
  category_id: string;
  total: number;
  item_count: number;
};

export type PaceResult = {
  /** 今月これまでの実績合計（円） */
  actualToDate: number;
  /** 経過日数 */
  elapsedDays: number;
  /** 月の総日数 */
  daysInMonth: number;
};

// =====================================================================
// 月次合計（records ベース）
// =====================================================================

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

/** 指定月（YYYY-MM）の合計のみ抜き出す。該当が無ければ 0 */
export function monthlyTotal(rows: RecordRow[], yearMonth: string): number {
  return rows
    .filter((r) => r.purchased_at.slice(0, 7) === yearMonth)
    .reduce((sum, r) => sum + r.total_amount, 0);
}

/** 過去 months ヶ月（当月含む）の月次推移を古い順 → 新しい順で返す。
 *  データが無い月は total = 0, record_count = 0 で埋める。 */
export function monthlyHistory(
  rows: RecordRow[],
  today: Date,
  months: number,
): MonthlyRow[] {
  const summary = new Map<string, { total: number; record_count: number }>();
  for (const r of rows) {
    const ym = r.purchased_at.slice(0, 7);
    const cur = summary.get(ym) ?? { total: 0, record_count: 0 };
    cur.total += r.total_amount;
    cur.record_count += 1;
    summary.set(ym, cur);
  }

  const result: MonthlyRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const v = summary.get(ym) ?? { total: 0, record_count: 0 };
    result.push({ year_month: ym, ...v });
  }
  return result;
}

// =====================================================================
// カテゴリ別内訳（items ベース）
// =====================================================================

/** 指定月（YYYY-MM）に属する items を category_id ごとに集計。
 *  total_price - discount を合算する。 */
export function categoryBreakdown(
  items: ItemForAggregation[],
  yearMonth: string,
): CategoryBreakdownRow[] {
  const filtered = items.filter((it) => it.purchased_at.slice(0, 7) === yearMonth);
  const map = new Map<string, { total: number; item_count: number }>();
  for (const it of filtered) {
    const net = (it.total_price ?? 0) - (it.discount ?? 0);
    const cur = map.get(it.category_id) ?? { total: 0, item_count: 0 };
    cur.total += net;
    cur.item_count += 1;
    map.set(it.category_id, cur);
  }
  return [...map.entries()]
    .map(([category_id, v]) => ({ category_id, ...v }))
    .sort((a, b) => b.total - a.total); // 金額の多い順
}

// =====================================================================
// 今日までのペース計算
// =====================================================================

/** 今日までの実績合計 + 経過/総日数を返す。
 *  以前は paceProjection (日割り月末予想) も返していたが、固定費混在による
 *  精度ブレでユーザー UX が悪かったため UI ごと削除し、関数側もシンプル化した。 */
export function paceForMonth(
  monthlyTotalAmount: number,
  today: Date,
): PaceResult {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const elapsedDays = today.getDate();
  return {
    actualToDate: monthlyTotalAmount,
    elapsedDays,
    daysInMonth,
  };
}

// =====================================================================
// 前月比
// =====================================================================

/** 前月比（百分率）。前月が 0 円の場合は null。 */
export function monthOverMonthRatio(
  thisMonthTotal: number,
  lastMonthTotal: number,
): number | null {
  if (lastMonthTotal === 0) return null;
  return Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 1000) / 10;
}

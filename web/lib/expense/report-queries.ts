// レポート画面用のサーバーサイドクエリ集約
//
// 設計書: docs/design.md §5 / §8

import { createClient } from "@/lib/supabase/server";
import { listCategories } from "./categories-server";
import {
  categoryBreakdown,
  monthlyHistory,
  monthlyTotal,
  monthOverMonthRatio,
  type CategoryBreakdownRow,
  type ItemForAggregation,
  type MonthlyRow,
} from "./aggregations";
import type { ExpenseCategory } from "@/types/database";

export interface ReportData {
  yearMonth: string; // YYYY-MM (対象月)
  categories: ExpenseCategory[];
  /** 当月のカテゴリ別内訳 */
  breakdown: CategoryBreakdownRow[];
  /** 過去 N ヶ月の月次推移 */
  history: MonthlyRow[];
  /** 当月合計 */
  monthTotal: number;
  /** 前月比 (%)、前月 0 円 → null */
  momRatio: number | null;
}

/** YYYY-MM 形式 */
function formatYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 月初日付の YYYY-MM-DD */
function monthStart(d: Date): string {
  return `${formatYearMonth(d)}-01`;
}

/** 過去 N ヶ月含めたレポートデータを取得
 *  @param targetYearMonth 対象月（YYYY-MM）。省略時は今月。
 *  @param historyMonths 月次推移に含める月数（当月含む）
 */
export async function loadReportData(
  targetYearMonth?: string,
  historyMonths = 6,
): Promise<ReportData> {
  const supabase = await createClient();

  const today = new Date();
  const ym = targetYearMonth ?? formatYearMonth(today);
  const [yStr, mStr] = ym.split("-");
  const targetDate = new Date(Number(yStr), Number(mStr) - 1, 1);

  // history 取得範囲: targetDate から N-1 ヶ月遡る
  const sinceDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - (historyMonths - 1), 1);
  const sinceStr = monthStart(sinceDate);

  // 期間内の records + items + categories を一括取得
  const [recordsRes, categories] = await Promise.all([
    supabase
      .from("expense_records")
      .select("id, purchased_at, total_amount, expense_items(id, category_id, total_price, discount, expense_record_id)")
      .gte("purchased_at", sinceStr),
    listCategories(supabase),
  ]);

  type RecordItemRow = {
    id: string;
    category_id: string;
    total_price: number;
    discount: number;
    expense_record_id: string;
  };
  const records = (recordsRes.data ?? []) as {
    id: string;
    purchased_at: string;
    total_amount: number;
    expense_items: RecordItemRow[] | null;
  }[];

  // 月次推移
  const history = monthlyHistory(
    records.map((r) => ({ purchased_at: r.purchased_at, total_amount: r.total_amount })),
    targetDate,
    historyMonths,
  );

  // カテゴリ別内訳（対象月のみ）
  const items: ItemForAggregation[] = [];
  for (const rec of records) {
    for (const it of rec.expense_items ?? []) {
      items.push({
        category_id: it.category_id,
        total_price: it.total_price,
        discount: it.discount,
        expense_record_id: it.expense_record_id,
        purchased_at: rec.purchased_at,
      });
    }
  }
  const breakdown = categoryBreakdown(items, ym);

  // 当月合計と前月比
  const thisMonthTotal = monthlyTotal(
    records.map((r) => ({ purchased_at: r.purchased_at, total_amount: r.total_amount })),
    ym,
  );
  const lastMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
  const lastYm = formatYearMonth(lastMonth);
  const lastMonthTotal = monthlyTotal(
    records.map((r) => ({ purchased_at: r.purchased_at, total_amount: r.total_amount })),
    lastYm,
  );

  return {
    yearMonth: ym,
    categories,
    breakdown,
    history,
    monthTotal: thisMonthTotal,
    momRatio: monthOverMonthRatio(thisMonthTotal, lastMonthTotal),
  };
}

// ダッシュボード用のサーバーサイドクエリ集約
//
// 設計書: docs/design.md §5 / §8

import { createClient } from "@/lib/supabase/server";
import { listCategories } from "./categories-server";
import {
  categoryBreakdown,
  monthlyTotal,
  paceForMonth,
  type CategoryBreakdownRow,
  type ItemForAggregation,
  type PaceResult,
} from "./aggregations";
import { pendingMonths } from "./recurring";
import type { ExpenseCategory, RecurringExpense } from "@/types/database";

export interface DashboardData {
  yearMonth: string; // YYYY-MM (今月)
  categories: ExpenseCategory[];
  /** 今月のカテゴリ別内訳（金額の多い順） */
  breakdown: CategoryBreakdownRow[];
  /** 今月の合計とペース */
  pace: PaceResult;
  /** 未計上の固定費アラート用 */
  pendingRecurring: {
    count: number;
    templateNames: string[];
  };
}

/** 今月のダッシュボード用データを 1 リクエストで取得 */
export async function loadDashboardData(today: Date = new Date()): Promise<DashboardData> {
  const supabase = await createClient();

  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${yearMonth}-01`;

  // 当月の expense_records + items を一括取得
  // RLS で自分のデータのみ返る
  const [recordsRes, recurringRes, categories] = await Promise.all([
    supabase
      .from("expense_records")
      .select("id, purchased_at, total_amount, expense_items(id, category_id, total_price, discount, expense_record_id)")
      .gte("purchased_at", monthStart),
    supabase.from("recurring_expenses").select("*").eq("active", true),
    listCategories(supabase),
  ]);

  // 月次合計（records ベース）
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
  const total = monthlyTotal(
    records.map((r) => ({ purchased_at: r.purchased_at, total_amount: r.total_amount })),
    yearMonth,
  );
  const pace = paceForMonth(total, today);

  // カテゴリ別内訳（items を平坦化して purchased_at を親 record から付与）
  const items: ItemForAggregation[] = [];
  for (const rec of records) {
    const recItems = rec.expense_items ?? [];
    for (const it of recItems) {
      items.push({
        category_id: it.category_id,
        total_price: it.total_price,
        discount: it.discount,
        expense_record_id: it.expense_record_id,
        purchased_at: rec.purchased_at,
      });
    }
  }
  const breakdown = categoryBreakdown(items, yearMonth);

  // 未計上固定費の集計
  const recurring = (recurringRes.data ?? []) as RecurringExpense[];
  let pendingCount = 0;
  const templateNames: string[] = [];
  for (const rec of recurring) {
    const pending = pendingMonths(rec, today);
    if (pending.length > 0) {
      pendingCount += pending.length;
      templateNames.push(rec.name);
    }
  }

  return {
    yearMonth,
    categories,
    breakdown,
    pace,
    pendingRecurring: {
      count: pendingCount,
      templateNames,
    },
  };
}

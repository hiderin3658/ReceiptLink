// 支出関連の Server Component 向け データ取得ヘルパー
//
// すべて RLS で守られているため authenticated user のもののみ返る前提。
// 各 Server Component / Route Handler の冒頭で `supabase.auth.getUser()` を
// 呼んでガードする方針（middleware は Edge Runtime 互換性回避のため不使用）。
//
// 集約ロジックは aggregations.ts に分離して純粋関数化（単体テスト容易化）

import { createClient } from "@/lib/supabase/server";
import type { ExpenseRecord, ExpenseRecordWithItems } from "@/types/database";
import { aggregateMonthlySummary, type MonthlyRow } from "./aggregations";

/** 支出履歴 N 件取得（新しい順）。LIMIT は安全な上限を設ける。 */
export async function listExpenseRecords(limit = 50): Promise<ExpenseRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_records")
    .select("*")
    .order("purchased_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ExpenseRecord[];
}

/** 単一の支出記録（明細含む）を取得。RLS で他ユーザーのは弾かれる。 */
export async function getExpenseRecord(
  id: string,
): Promise<ExpenseRecordWithItems | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_records")
    .select("*, expense_items(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as ExpenseRecordWithItems | null) ?? null;
}

/** 月別合計（YYYY-MM をキーにした合計金額）を直近 N ヶ月で集計する */
export async function getMonthlySummary(months = 6): Promise<MonthlyRow[]> {
  const supabase = await createClient();
  // 簡易実装: 直近 N ヶ月分の records を取って JS 側で集計（aggregations.ts）。
  // 件数が増えてきたら DB View に置き換える。
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("expense_records")
    .select("purchased_at, total_amount")
    .gte("purchased_at", sinceStr)
    .order("purchased_at", { ascending: false });
  return aggregateMonthlySummary(
    (data ?? []) as { purchased_at: string; total_amount: number }[],
  );
}

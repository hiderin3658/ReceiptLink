// expense_categories の DB アクセスヘルパー（Server Component / Route Handler 専用）
//
// next/headers を使うため、クライアントコンポーネントから import 不可。
// 純粋関数は ./categories.ts を参照。

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/types/database";

/** 利用可能カテゴリを sort_order → name 順で取得。
 *  RLS で「標準カテゴリ + 自分のカスタムカテゴリ」のみ返る。
 *  DB エラー時は console.error に詳細を流し、空配列を返す（UI 側で「カテゴリなし」表示）。 */
export async function listCategories(
  supabase?: SupabaseClient,
): Promise<ExpenseCategory[]> {
  const sb = supabase ?? (await createClient());
  const { data, error } = await sb
    .from("expense_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("[expense] listCategories failed:", error.message);
    return [];
  }
  return (data ?? []) as ExpenseCategory[];
}

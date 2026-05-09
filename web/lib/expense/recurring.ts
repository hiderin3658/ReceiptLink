// 固定費（recurring_expenses）の自動計上ロジック
//
// 設計書: docs/design.md §7
// マイグレーション: supabase/migrations/20260509000001_initial_schema.sql

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecurringExpense } from "@/types/database";

// =====================================================================
// 純粋関数: 月末丸め
// =====================================================================

/** 指定の年月において day_of_month が存在しない場合は月末日に丸める。
 *
 *  例: resolveDayOfMonth(2026, 2, 31) → 28（うるう年なら 29）
 *      resolveDayOfMonth(2026, 4, 31) → 30
 *      resolveDayOfMonth(2026, 5, 15) → 15
 *
 *  @param year   YYYY
 *  @param month  1-12
 *  @param dayOfMonth 1-31
 *  @returns 当月の有効な日（1-31）
 */
export function resolveDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  const lastDay = new Date(year, month, 0).getDate(); // month は 1-indexed のまま渡すと翌月の 0 日 = 当月末
  return Math.min(dayOfMonth, lastDay);
}

// =====================================================================
// 純粋関数: 未生成月の列挙
// =====================================================================

/** 月初を YYYY-MM-DD 形式で表現（DB の date 型と整合） */
function monthStartString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** YYYY-MM-DD（または YYYY-MM-01）の文字列を { year, month } に分解 */
function parseMonthStart(s: string): { year: number; month: number } {
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) throw new Error(`Invalid month string: ${s}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** ある固定費レコードについて、当月までに生成されるべきだがまだ生成されていない月の一覧を返す。
 *
 *  挙動:
 *  - active = false の場合は空配列
 *  - last_generated_month が null（初回）の場合は created_at の翌月から当月まで
 *    （※ 過去全て遡るのではなく「テンプレ作成後」の月から計上開始）
 *  - last_generated_month がある場合は、その翌月から当月まで
 *
 *  返り値の各要素は YYYY-MM-01 形式の文字列。古い順。
 */
export function pendingMonths(rec: RecurringExpense, today: Date): string[] {
  if (!rec.active) return [];

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed

  // 開始月の決定
  let startYear: number;
  let startMonth: number;
  if (rec.last_generated_month) {
    const last = parseMonthStart(rec.last_generated_month);
    // 翌月から
    if (last.month === 12) {
      startYear = last.year + 1;
      startMonth = 1;
    } else {
      startYear = last.year;
      startMonth = last.month + 1;
    }
  } else {
    // 初回: created_at の翌月から開始
    const created = new Date(rec.created_at);
    const cy = created.getFullYear();
    const cm = created.getMonth() + 1;
    if (cm === 12) {
      startYear = cy + 1;
      startMonth = 1;
    } else {
      startYear = cy;
      startMonth = cm + 1;
    }
  }

  const result: string[] = [];
  let y = startYear;
  let m = startMonth;
  while (y < todayYear || (y === todayYear && m <= todayMonth)) {
    result.push(monthStartString(y, m));
    if (m === 12) {
      y += 1;
      m = 1;
    } else {
      m += 1;
    }
  }
  return result;
}

// =====================================================================
// Server-side: 未生成分を一括 INSERT して last_generated_month を更新
// =====================================================================

export type GenerationResult = {
  generated: number;
  errors: string[];
};

/** 認証ユーザーの全固定費について未生成分を一括生成。
 *
 *  ⚠️ 呼出側責任:
 *    - 本関数は userId を引数で受けるため、悪意ある呼出を防ぐため
 *      **必ず Server Action / Route Handler 内で `supabase.auth.getUser()` で
 *      取得した user.id を渡すこと**。
 *    - クライアントから受け取った任意の userId を渡してはならない。
 *    - DB 側 RLS でも他人レコード INSERT は防げるが、UI への結果表示が
 *      混乱するため呼出側で確実にガードする。
 */
export async function generatePendingExpenses(
  supabase: SupabaseClient,
  userId: string,
  today: Date = new Date(),
): Promise<GenerationResult> {
  const { data: recurring, error: fetchErr } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);
  if (fetchErr) {
    return { generated: 0, errors: [fetchErr.message] };
  }

  let generated = 0;
  const errors: string[] = [];

  for (const rec of (recurring ?? []) as RecurringExpense[]) {
    const pending = pendingMonths(rec, today);
    if (pending.length === 0) continue;

    let lastSuccess: string | null = rec.last_generated_month;
    for (const monthStart of pending) {
      const { year, month } = parseMonthStart(monthStart);
      const day = resolveDayOfMonth(year, month, rec.day_of_month);
      const purchasedAt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();

      // 1) expense_records に親レコード INSERT
      const { data: rec_, error: recErr } = await supabase
        .from("expense_records")
        .insert({
          user_id: userId,
          purchased_at: purchasedAt,
          store_name: null,
          total_amount: rec.amount,
          note: rec.note,
          image_paths: [],
          source_type: "recurring",
          recurring_expense_id: rec.id,
        })
        .select("id")
        .single();
      if (recErr || !rec_) {
        errors.push(`${rec.name} (${monthStart}): record insert failed: ${recErr?.message}`);
        continue;
      }

      // 2) expense_items に 1 行の明細を INSERT
      const { error: itemErr } = await supabase.from("expense_items").insert({
        expense_record_id: rec_.id,
        category_id: rec.category_id,
        raw_name: rec.name,
        display_name: rec.name,
        quantity: 1,
        unit: null,
        unit_price: rec.amount,
        total_price: rec.amount,
        discount: 0,
      });
      if (itemErr) {
        // 親レコードをロールバック
        await supabase.from("expense_records").delete().eq("id", rec_.id);
        errors.push(`${rec.name} (${monthStart}): item insert failed: ${itemErr.message}`);
        continue;
      }

      generated += 1;
      lastSuccess = monthStart;
    }

    // last_generated_month を最後に成功した月で更新
    if (lastSuccess && lastSuccess !== rec.last_generated_month) {
      await supabase
        .from("recurring_expenses")
        .update({ last_generated_month: lastSuccess })
        .eq("id", rec.id);
    }
  }

  return { generated, errors };
}

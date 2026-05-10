"use server";

// 固定費（recurring_expenses）の Server Action
//
// クライアント (ダッシュボード) からフォーム経由で呼ばれる。
// 必ず認証ユーザーの id を auth.getUser() で取得して generatePendingExpenses に渡す
// （recurring.ts のドキュメント通りの呼出）

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generatePendingExpenses, type GenerationResult } from "./recurring";

export interface GeneratePendingState {
  ok: boolean;
  generated: number;
  errors: string[];
  message: string;
}

/** 未計上の固定費を一括生成。dashboard の useTransition から呼ばれる前提。 */
export async function generatePendingExpensesAction(
  _prev: GeneratePendingState | null,
): Promise<GeneratePendingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      generated: 0,
      errors: ["認証が必要です"],
      message: "認証が必要です。再度ログインしてください。",
    };
  }

  const result: GenerationResult = await generatePendingExpenses(supabase, user.id);

  // 履歴 / ダッシュボード両方を再検証
  revalidatePath("/expense");
  revalidatePath("/dashboard");

  if (result.errors.length > 0 && result.generated === 0) {
    return {
      ok: false,
      generated: 0,
      errors: result.errors,
      message: `生成に失敗しました（${result.errors.length} 件のエラー）`,
    };
  }
  return {
    ok: true,
    generated: result.generated,
    errors: result.errors,
    message:
      result.generated === 0
        ? "未計上の固定費はありませんでした"
        : `固定費 ${result.generated} 件を計上しました`,
  };
}

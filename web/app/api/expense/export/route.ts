// 支出履歴 CSV エクスポートエンドポイント
//
// GET /api/expense/export
// → ログインユーザーの全 expense_records + expense_items を結合した CSV を返す。
//   RLS で守られているため、自分のデータのみ取得される。

import { createClient } from "@/lib/supabase/server";
import {
  buildCategoryNameMap,
  buildCsvFileName,
  buildExpenseCsv,
} from "@/lib/expense/csv";
import { listCategories } from "@/lib/expense/categories-server";
import type { ExpenseRecordWithItems } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 全件取得。MVP では件数が少ない（個人利用）想定。
  // 将来運用で 1,000 件超えたらサーバー側ストリーミング or 月別ダウンロードに切替予定
  const [recordsResult, categories] = await Promise.all([
    supabase
      .from("expense_records")
      .select("*, expense_items(*)")
      .order("purchased_at", { ascending: false })
      .order("created_at", { ascending: false }),
    listCategories(supabase),
  ]);
  const { data, error } = recordsResult;
  if (error) {
    // 詳細エラーはサーバーログにのみ流し、クライアントには汎用文言を返す
    console.error("[expense/export] query failed:", error.message);
    return new Response("Failed to export expense records", { status: 500 });
  }

  const records = (data ?? []) as ExpenseRecordWithItems[];
  const csv = buildExpenseCsv(records, buildCategoryNameMap(categories));
  // Excel / Numbers が UTF-8 を正しく認識するよう先頭に BOM (U+FEFF) を付与
  const body = "﻿" + csv;
  const filename = buildCsvFileName();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

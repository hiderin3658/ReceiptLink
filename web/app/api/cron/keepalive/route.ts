// Supabase Free プランの Auto-pause (7 日間アクセスなしで停止) を回避するため、
// 毎日 1 回 軽量 SELECT を実行して DB へのアクセスを発生させる。
//
// 呼出: Vercel Cron (vercel.json の crons 設定) が JST 24:00 (UTC 15:00) に GET。
// 認証: Vercel Cron は Authorization: Bearer $CRON_SECRET ヘッダを自動付与する。
//       環境変数 CRON_SECRET を Vercel に設定すること。

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  // CRON_SECRET 未設定 or ヘッダ不一致は 401。誤って公開 URL を叩かれても DB アクセスを発生させない。
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // head:true + count:exact で本体行を返さず COUNT のみ取得する軽量クエリ。
  // 標準カテゴリが必ず存在するテーブルを選ぶことで「DB クエリが成功する」ことも担保。
  const { error, count } = await supabase
    .from("expense_categories")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[cron/keepalive] supabase query failed:", error.message);
    return Response.json(
      { ok: false, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    categoriesCount: count ?? 0,
  });
}

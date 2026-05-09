"use server";

// user_profiles の更新 Server Actions
//
// 設計書: docs/design.md §4.3
// RLS: 自分の行のみ SELECT/INSERT/UPDATE 可

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  display_name: z
    .string()
    .trim()
    .max(50, "表示名は 50 文字以内")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  birth_year: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => {
      if (v === null || v === "" || v === undefined) return null;
      if (typeof v === "number") return v;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .pipe(z.number().int().min(1900).max(new Date().getFullYear()).nullable()),
});

export type ProfileInput = z.input<typeof inputSchema>;

export type ProfileActionState =
  | { ok: true }
  | { ok: false; message: string }
  | null;

export async function updateProfile(
  _prev: ProfileActionState,
  input: ProfileInput,
): Promise<ProfileActionState> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "認証が必要です" };

  // upsert: 初回ログイン時の自動作成（OAuth callback）に頼らず、ここでも安全に
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: user.id, ...parsed.data },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[profile] update failed:", error.message);
    return { ok: false, message: "プロフィールの更新に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

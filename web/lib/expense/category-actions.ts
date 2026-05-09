"use server";

// expense_categories の CRUD Server Actions
//
// 設計書: docs/design.md §5 / §4
// RLS: 自分のカスタムカテゴリのみ INSERT/UPDATE/DELETE 可、標準カテゴリは admin のみ

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const nameSchema = z
  .string()
  .trim()
  .min(1, "カテゴリ名は必須です")
  .max(20, "カテゴリ名は 20 文字以内");

const sortOrderSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .pipe(z.number().int().min(0).max(999));

export type CategoryActionState =
  | { ok: true }
  | { ok: false; message: string }
  | null;

/** カスタムカテゴリを新規追加 */
export async function createCategory(
  _prev: CategoryActionState,
  input: { name: string; sort_order?: number },
): Promise<CategoryActionState> {
  const nameParsed = nameSchema.safeParse(input.name);
  if (!nameParsed.success) {
    return { ok: false, message: nameParsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const sortOrder = sortOrderSchema.safeParse(input.sort_order ?? 100);
  if (!sortOrder.success) {
    return { ok: false, message: "並び順は 0〜999 の整数" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "認証が必要です" };

  const { error } = await supabase.from("expense_categories").insert({
    user_id: user.id,
    name: nameParsed.data,
    sort_order: sortOrder.data,
    is_default: false,
  });
  if (error) {
    console.error("[category] create failed:", error.message);
    // unique 違反 / 標準名重複トリガーのメッセージを伝達
    if (error.code === "23505" || error.message.includes("重複")) {
      return { ok: false, message: "同じ名前のカテゴリが既に存在します" };
    }
    return { ok: false, message: "カテゴリの追加に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/expense");
  revalidatePath("/expense/new");
  return { ok: true };
}

/** カスタムカテゴリの名前 / 並び順を更新（is_default = true は RLS で弾かれる） */
export async function updateCategory(
  id: string,
  _prev: CategoryActionState,
  input: { name: string; sort_order?: number },
): Promise<CategoryActionState> {
  const nameParsed = nameSchema.safeParse(input.name);
  if (!nameParsed.success) {
    return { ok: false, message: nameParsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const sortOrder = sortOrderSchema.safeParse(input.sort_order ?? 100);
  if (!sortOrder.success) {
    return { ok: false, message: "並び順は 0〜999 の整数" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ name: nameParsed.data, sort_order: sortOrder.data })
    .eq("id", id);
  if (error) {
    console.error("[category] update failed:", error.message);
    return { ok: false, message: "カテゴリの更新に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/expense");
  return { ok: true };
}

/** カスタムカテゴリを削除（紐付く expense_items がある場合 RLS の FK restrict で失敗） */
export async function deleteCategory(id: string): Promise<CategoryActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) {
    console.error("[category] delete failed:", error.message);
    if (error.code === "23503") {
      return {
        ok: false,
        message: "このカテゴリを使用している支出があるため削除できません",
      };
    }
    return { ok: false, message: "カテゴリの削除に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/expense");
  return { ok: true };
}

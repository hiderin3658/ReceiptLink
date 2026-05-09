"use server";

// recurring_expenses の CRUD Server Actions
//
// 設計書: docs/design.md §7

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  name: z.string().trim().min(1, "名前は必須です").max(50, "名前は 50 文字以内"),
  category_id: z.string().uuid("カテゴリを選択してください"),
  amount: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .pipe(z.number().int().nonnegative("0 以上で入力")),
  day_of_month: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .pipe(z.number().int().min(1, "1〜31").max(31, "1〜31")),
  active: z.boolean().default(true),
  note: z.string().trim().max(200).optional().transform((v) => (v && v.length > 0 ? v : null)),
});

export type RecurringInput = z.input<typeof inputSchema>;

export type RecurringActionState =
  | { ok: true; id?: string }
  | { ok: false; message: string }
  | null;

export async function createRecurring(
  _prev: RecurringActionState,
  input: RecurringInput,
): Promise<RecurringActionState> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "認証が必要です" };

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[recurring] create failed:", error?.message);
    return { ok: false, message: "固定費の追加に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateRecurring(
  id: string,
  _prev: RecurringActionState,
  input: RecurringInput,
): Promise<RecurringActionState> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .update(parsed.data)
    .eq("id", id);
  if (error) {
    console.error("[recurring] update failed:", error.message);
    return { ok: false, message: "固定費の更新に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteRecurring(id: string): Promise<RecurringActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) {
    console.error("[recurring] delete failed:", error.message);
    return { ok: false, message: "固定費の削除に失敗しました" };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
